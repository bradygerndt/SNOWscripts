new DiscoverySensor({
  process: function (result, ciData) {
    this.currentCI = this.getCmdbRecord()
    if (JSUtil.nil(this.currentCI.serial_number)) {
      DiscoveryLogger.error('Serial number for primary CI null', 'SNMP - Switch Modules', 'c93a45ffdb086b004f906693ca9619fe', this.currentCI.sysId);
      return;
    }
    var snmp = new SNMPResponse(result);
    var entTable = snmp.getOIDTable('iso.org.dod.internet.mgmt.mib-2.entityMIB.entityMIBObjects.entityPhysical', 'entPhysicalEntry');
    this.getSwitchDetails(entTable);
  },
  getSwitchDetails: function (entTable) {
    switchDetails = [];
    for (var ent in entTable) {
      //physical class 3 is for switch chassis.
      if (entTable[ent].entPhysicalClass == 3) {
        var ipSwitch = {};
        //collect all properties defined in probe for each switch. [serial number, physical class, name]
        for (var prop in entTable[ent]) {
          ipSwitch[prop] = entTable[ent][prop];
        }
        switchDetails.push(ipSwitch);
      }
    }
    this.updateSwitchCIs(this.currentCI, switchDetails);
    return switchDetails;
  },
  updateSwitchCIs: function (currentCI, switches) {
    var updatedSwitches = [];
    var jsonUtil = new JSON();
    var childSwitches = this.getChildSwitches(currentCI, switches);
    childSwitches.forEach(function (item) {
      //use hardware identifier for each member switch
      var payload = {
        'items': [
          {
            'className': currentCI.sys_class_name.toString() || 'cmdb_ci_ip_switch',
            'values': {
              'name': currentCI.name.toString() + ' - ' + (item.entPhysicalName || 'Member'),
              'model_id': currentCI.model_id.toString(),
              'serial_number': item.entPhysicalSerialNum,
              'ip_address' : currentCI.ip_address,
              'last_discovered': gs.nowDateTime()
            }
          }]
      };
      var input = jsonUtil.encode(payload);
      var output = SNC.IdentificationEngineScriptableApi.createOrUpdateCI('ServiceNow', input);
      var updates = jsonUtil.decode(output).items;
      for (var update in updates) {
        if (JSUtil.notNil(updates[update].sysId) && updates[update].sysId != 'Unknown') {
          DiscoveryLogger.info(updates[update].operation + ' on switch module', 'SNMP - Switch Modules', 'c93a45ffdb086b004f906693ca9619fe'/*Switch Module Sensor*/, updates[update].sysId);
          updatedSwitches.push(updates[update].sysId);
        }
      }
    });
    this.buildRelation(currentCI, updatedSwitches);
    return updatedSwitches;
  },
  buildRelation: function (currentCI, updatedSwitches) {
    var updateCount = 0;
    var currentID = currentCI.sys_id;
    updatedSwitches.forEach(function (item) {
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
  getChildSwitches: function (currentCI, switches) {
    var childSwitches = switches.filter(function (curSwitch) {
      //check that the switch does not match the current ci serial number.
      return curSwitch.entPhysicalSerialNum != currentCI.serial_number;
    });
    return childSwitches;
  },
  type: 'DiscoverySensor'
});
