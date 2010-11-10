/* See http://www.eol.org/api */

function PagesConfig() {
	/* See http://www.eol.org/api/docs/pages */
	this.images = 1;
	this.videos = 0;
	this.text = 1;
	//this.subjects = "Wikipedia|TaxonBiology|GeneralDescription|Description";
	this.details = 1;
	this.common_names = 1;
	this.vetted = 0;
	this.format = "html";
}

function HierarchyConfig() {
	//not-yet-documented hierarchy entries options.  They will eventually be listed at http://www.eol.org/api/docs/hierarchy_entries.
	this.synonyms = 0;
	this.common_names = 0;
}

function EolApi() {
	this.pagesConfig = new PagesConfig();
	this.hierarchyConfig = new HierarchyConfig();
//	this.apiHost = "labs1.eol.org";
	this.apiHost = "www.eol.org";
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
	//TODO handle unknown taxonIDs.  API response is like <response><error><message>Unknown identifier taxonID</message></error></response> 
	if (taxonID) {
		var url = "http://" + this.apiHost + "/api/hierarchy_entries/" + this.apiVersion + "/" + taxonID + ".json?callback=?";
		jQuery.getJSON(url, this.hierarchyConfig, onSuccess);
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

EolApi.prototype.search = function (query, onSuccess) {
	var url = "http://" + this.apiHost + "/api/search/" + this.apiVersion + "/" + query + ".json?callback=?";
	jQuery.getJSON(url, {}, onSuccess);
};

/* Gets search results and also adds the pages response (without media) for each result */
EolApi.prototype.searchHierarchyEntries = function (query, onSuccess) {
	var config = {
		images:0,
		videos:0,
		text:0,
		common_names:0
	}
	
	var that = this;
	var searchResponse;
	var pageResponseCount = 0;
	
	//a function for setting search result taxon ids below
	var setPage = function (index, searchResult) {
		that.pages(searchResult.id, config, function (page) {
			searchResult.page = page;

			pageResponseCount++;
			if (pageResponseCount === searchResponse.results.length) {
				onSuccess(searchResponse);
			}
		});
	}; 
	
	this.search(query, function (response) {
		searchResponse = response;
		jQuery.each(response.results, setPage);
	});
};

EolApi.prototype.decorateNode = function (node, callback) {
	this.pages(node.taxonConceptID, this.pagesConfig, function (json) {
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