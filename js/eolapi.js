/* See http://www.eol.org/api */

function EolApiConfig() {
	/* See http://www.eol.org/api/docs/pages */
	this.images = 1;
	this.text = 1;
	//this.subjects = "Wikipedia|TaxonBiology|GeneralDescription|Description"; //TODO: Ask patrick if text is returned in order of this parameter. E.g. If I request one text item will that one item match my first subject, if possible?  (It doesn't appear to be the case.)
	this.details = 1;
	this.common_names = 1;
	this.vetted = 0;
	this.format = "html";
}

function EolApi() {
	this.defaultConfig = new EolApiConfig();
	this.apiHost = "labs1.eol.org";
	//this.apiHost = "www.eol.org";
	this.apiVersion = "1.0";
	
}

EolApi.prototype.ping = function (success, error) {
	jQuery.ajax({
		type: "GET",
		dataType: "jsonp",
		cache: false,
		url: "http://" + this.apiHost + "/api/ping.json",
		timeout: 3000,
		success: success,
		error: error
	});
};

EolApi.prototype.hierarchy_entries = function (taxonID, onSuccess) {
	if (taxonID) {
		var url = "http://" + this.apiHost + "/api/hierarchy_entries/" + this.apiVersion + "/" + taxonID + ".json?callback=?";
		jQuery.getJSON(url, {}, onSuccess);
	}
};

EolApi.prototype.pages = function (taxonConceptID, config, onSuccess) {
	if (taxonConceptID) {
		var url = "http://" + this.apiHost + "/api/pages/" + this.apiVersion + "/" + taxonConceptID + ".json?callback=?";
		jQuery.getJSON(url, config, onSuccess);
	}
};

EolApi.prototype.data_objects = function (objectID, onSuccess) {
	if (objectID) {
		var url = "http://" + this.apiHost + "/api/data_objects/" + this.apiVersion + "/" + objectID + ".json?callback=?";
		jQuery.getJSON(url, {}, onSuccess);
	}
	
};

EolApi.prototype.decorateNode = function (node, callback) {
	this.pages(node.taxonConceptID, this.defaultConfig, function (json) {
		//just appending the whole dataObject to the node
		node.image = jQuery.grep(json.dataObjects, function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/StillImage";
		})[0];
		
		node.text = jQuery.grep(json.dataObjects, function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/Text";
		})[0];
		
		node.vernacularNames = json.vernacularNames;
		
		callback();
	});
};