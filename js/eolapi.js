/* See http://wiki.eol.org/display/dev/pages */

function EolApiConfig() {
	this.images = 1;
	this.text = 1;
	this.subjects = "TaxonBiology|GeneralDescription|Description";
	this.details = 1;
	this.common_names = 0;
	this.vetted = 0;
	this.format = "html";
}

function EolApi() {
	this.defaultConfig = new EolApiConfig();
}

EolApi.prototype.ping = function (success, error) {
	jQuery.ajax({
		type: "GET",
		dataType: "jsonp",
		cache: false,
		url: "http://www.eol.org/api/ping.json",
		timeout: 3000,
		success: success,
		error: error
	});
};

EolApi.prototype.hierarchy_entries = function (taxonID, onSuccess) {
	var url = "http://www.eol.org/api/hierarchy_entries/" + taxonID + ".json?callback=?";
	jQuery.getJSON(url, {}, onSuccess);
};

EolApi.prototype.pages = function (taxonConceptID, config, onSuccess) {
	var url = "http://www.eol.org/api/pages/" + taxonConceptID + ".json?callback=?";
	jQuery.getJSON(url, config, onSuccess);
};

EolApi.prototype.data_objects = function (objectID, onSuccess) {
	var url =  "http://www.eol.org/api/data_objects/" + objectID + ".json?callback=?";
	jQuery.getJSON(url, {}, onSuccess);
};

EolApi.prototype.decorateNode = function (node, callback) {
	this.pages(node.taxonConceptID, this.defaultConfig, function (json) {
		//just appending the whole dataObject to the node
		node.image = json.dataObjects.filter(function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/StillImage";
		})[0];
		node.text = json.dataObjects.filter(function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/Text";
		})[0];
		callback();
	});
};