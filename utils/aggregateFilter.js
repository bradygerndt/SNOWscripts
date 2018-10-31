/** 

 * Apply a number of aggregate functions as a condition to a standard filter (ie. Count, Average, Sum.)

 * Takes table name and encoded query string then returns an array of the specified field of records that meet the aggregate condition.

 * 

 * SCRIPTED FILTER EXAMPLE

 * [Serial Number] [is] [javascript:u_aggregate('cmdb_ci', 'install_status!=7', 'serial_number', 'COUNT', '>', 1)]
 * 
 * Read as: 
 * Filter records where serial number 
 * is in the list of serial numbers
 * from the cmbd_ci table 
 * where install status does not equal 7 
 * and where serial number has a count of greater than 1.

 * @param {string} tableName - name of table for GlideRecord 
 * @param {string} encodedQuery - encoded query string 
 * @param {string} aggregator - aggregation function to be applied. (COUNT, SUM, MIN, MAX, AVG)
 * @param {string} operator - operator to use in comparison ()
 * @param {int} value - value to be used in comparison to aggregator.
 * @param {string} groupBy - field to aggregate by.
 * @return {string[]} array of sys_id of sample records that meet criteria.

 */


function u_aggregate(tableName, encodedQuery, groupBy, aggregator, operator, value) {
	
	try {
		
		var agg = new GlideAggregate(tableName);
	
		//Check input
		if (!agg.isValid()) throw 'Invalid table name "' + tableName + '".';
			
		if (!agg.canRead()) throw 'No permission to read from "' + tableName + '".'; 
		
		if (agg.getElement(groupBy) == null) throw 'Cannot group by "' + groupBy + '"because it was not found in the provided table.';
		
		aggregator = aggregator.toUpperCase();
		var aggCheck = ['COUNT','SUM','MIN','MAX','AVG'].indexOf(aggregator);
		if (aggCheck < 0) throw 'Aggregate function must be AVG, COUNT or SUM.';
		
		var opCheck = ['>','<','>=','<=','=','!='].indexOf(operator);
		if (opCheck < 0) throw "Operator must be one of (>, <, >=, <=, =, !=)";
		//Check input
		
		var records = [];
		
		//query with aggregate
		if (encodedQuery) agg.addQuery(encodedQuery);
		agg.addAggregate(aggregator, groupBy);
		agg.groupBy(groupBy);
		agg.addHaving(aggregator, operator, value);
		agg.query();
		
		
		while(agg.next()){
			records.push(agg.getValue(groupBy));
		}
		
		return records;
		
	}
	
	catch (e) {
		
		return 'ERROR: ' + e;   // return error message
		
	}
	
}
