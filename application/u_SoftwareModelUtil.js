var u_SoftwareModelUtil = Class.create();
u_SoftwareModelUtil.prototype = {
	addSoftwareModeltoService: function (swInstall) {
		if (!swInstall.discovery_model.model.nil()) {
			var ciu = new CIUtils();
			var services = ciu.servicesAffectedByCI(swInstall.installed_on);
			for (var i in services) {
				var gr = new GlideRecord('sn_apm_tpm_service_software_model');
				gr.get('business_service', services[i]);
				gr.addQuery('software_model', swInstall.discovery_model.model);
				gr.query();
				//make sure the relationship doesn't already exist and create new record.
				if (!gr.next()) {
					var sm = new GlideRecord('sn_apm_tpm_service_software_model');
					sm.initialize();
					sm.software_model = swInstall.discovery_model.model;
					sm.business_service = services[i];
					sm.insert();
				}
			}
		}
	},

	removeSoftwareModelfromService: function (swInstall) {
		if (!swInstall.discovery_model.model.nil()) {
			var ciu = new CIUtils();
			var services = ciu.servicesAffectedByCI(swInstall.installed_on);
			//check all of the hardware with installs.
			for (var i in services) {
				var check = this.checkServiceHWForModel(services[i], swInstall.discovery_model.model);
				//if this is the only hardware that has the software installed for the service.
				if (check.length == 1 && check[0] == swInstall.installed_on) {
					var gr = new GlideRecord('sn_apm_tpm_service_software_model');
					gr.get('business_service.sys_id', services[i]);
					gr.addQuery('software_model.sys_id', swInstall.discovery_model.model);
					gr.query();
					if (gr.next()) {
						gr.deleteRecord();
					}
				}
			}
		}
	},

	addSoftwareModelbyRel: function (rel) {
		/* need to add software models to a service if a new relationship is created between hardware and a service.
		*  Will run on cmdb_ci_rel table when a new relationship is created between hardware and a business service.
		*/

		var service = rel.parent;
		var server = rel.child;
		//process all software installs on child server that have software models.
		var installsGr = new GlideRecord('cmdb_sam_sw_install');
		installsGr.addQuery('installed_on', server);
		installsGr.addNotNullQuery('discovery_model.model');
		installsGr.query();
		while (installsGr.next()) {
			this.addSoftwareModeltoService(installsGr);
		}
	},
	removeSoftwareModelbyRel: function (rel) {
		/* need to remove software models from a service if a relationship is remvoed between hardware and a service.
		*  Will run on cmdb_ci_rel table when a relationship is deleted between hardware and a business service.
		*/

		var service = rel.parent;
		var server = rel.child;
		//process all software installs on child server that have software models.
		var installsGr = new GlideRecord('cmdb_sam_sw_install');
		installsGr.addQuery('installed_on', server);
		installsGr.addNotNullQuery('discovery_model.model');
		installsGr.query();
		while (installsGr.next()) {
			this.removeSoftwareModelfromService(installsGr);
		}
	},
	getAllServiceHW: function (businessService) {
		/*
 		* Get all directly related supporting hardware.
 		*/
		var hardwareIds = [];
		var gr = new GlideRecord('cmdb_rel_ci');
		gr.addQuery('parent.sys_id', businessService);
		gr.addQuery('child.category', 'Hardware');
		gr.query();

		while (gr.next()) {
			hardwareIds.push(gr.child.sys_id);
		}
		return hardwareIds;
	},

	checkServiceHWForModel: function (service, softwareModel) {
		/*
 		* Check to see if the other infrastructure supporting the service utilize the software model.
 		*
 		* Start by checking all computers that are directly related to the business service to see if they have any software installations
 		* for discovery models that are tied back to the software model related to the business service.
 		*
 		* This currently only looks one level below the business service to hardware components.
 		*/
		var hardwareIds = this.getAllServiceHW(service);
		var installedOn = [];

		var gr = new GlideRecord('cmdb_sam_sw_install');
		gr.addQuery('installed_on.sys_id', 'IN', hardwareIds);
		gr.addQuery('discovery_model.model', softwareModel);
		gr.query();

		while (gr.next()) {
			installedOn.push(gr.installed_on.sys_id);
		}

		return installedOn;
	},

	type: 'u_SoftwareModelUtil'
};
