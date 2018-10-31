new DiscoverySensor({
	process: function (result) {
		var snmp = new SNMPResponse(result);
		var bsnAPTable = snmp.getOIDTable('iso.org.dod.internet.private.enterprises.airespace.bsnWireless.bsnAP', 'bsnAPEntry');
		this.currentCi = this.getCmdbRecord();
		this.getAPDetails(bsnAPTable);
	},
	getAPDetails: function (bsnAPTable) {
		var aps = [];
		var wcMf = this.currentCi.manufacturer.getDisplayValue();
		for (var entry in bsnAPTable) {
			var ap = {};
			//get details from Airespace MIB
			this.appendProperties(ap, bsnAPTable[entry], "@instance");
			ap.model_id = this.getAPMakeandModel(wcMf, ap.bsnAPModel);
			this.updateAPCIs(aps);
			aps.push(ap);
		}

	},
	updateAPCIs: function (aps) {
		var updatedAps = [];
		var json = new JSON();
		aps.forEach(function (ap) {
			var payload = {
				"items": [
					{
						"className": "cmdb_ci_wap_network",
						"values": {
							"name": ap.bsnAPName,
							"serial_number": ap.bsnAPSerialNumber,
							"model_id": ap.model_id,
							"manufacturer": this.currentCi.manufacturer.toString(),
							"last_discovered": gs.nowDateTime(),
							"ip_address": ap.bsnApIpAddress.toString(),
							"mac_address": ap.bsnAPEthernetMacAddress
						}
					}
				]
			};
			var input = json.encode(payload);
			var output = SNC.IdentificationEngineScriptableApi.createOrUpdateCI('ServiceNow', input);
			gs.log(output);
			var updates = json.decode(output).items;
			for (var update in updates) {
				if (JSUtil.notNil(updates[update].sysId) && updates[update].sysId != "Unknown") {
					updatedAps.push(updates[update].sysId);
				}
			}
		});
		this.buildRelation(this.currentCi, updatedAps);
		return updatedAps;
	},
	buildRelation: function (currentCI, updatedAps) {
		var updateCount = 0;
		var currentID = currentCI.sys_id;
		updatedAps.forEach(function (item) {
			var grRel = new GlideRecord('cmdb_rel_ci');
			grRel.addQuery('parent', currentID);
			grRel.addQuery('child', item);
			grRel.query();
			//check for existing relationship
			if (item && !grRel.next()) {
				grRel.initialize();
				grRel.child = item;
				grRel.parent = currentID;
				grRel.type = '55c913d3c0a8010e012d1563182d6050'; //member of
				grRel.insert();
				updateCount += 1;
			}
		});
		return updateCount;
	},
	getAPMakeandModel: function (make, model) {
		var mam = new MakeAndModelJS.fromNames(make, model, 'hardware');
		var modelID = mam.getModelNameSysID();
		return modelID;
	},
	appendProperties: function (objOut, objIn, exclude) {
		//map all properties from objIn to new object [objOut]
		//will overwrite if you pass in existing props. Can exclude keys with the exclude parameter.

		//handle strings in exclude.
		if (typeof exclude == "string") exclude = [exclude];

		for (var prop in objIn) {
			//SN JS engine does not have Array.includes().
			if (new ArrayUtil().contains(exclude, prop) == false) {
				objOut[prop] = objIn[prop];
			}
		}
	},
	type: 'DiscoverySensor'
});
