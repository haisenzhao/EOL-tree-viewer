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

EolApi.prototype.search = function (query, config, onSuccess) {
	if (typeof(config) == "function") {
		onSuccess = config; 
		config = {};
	}
	
	if (!query || !onSuccess) return;
	
	var url = "http://" + this.apiHost + "/api/search/" + this.apiVersion + "/" + query + ".json?callback=?";
	jQuery.getJSON(url, config, onSuccess);
};

EolApi.prototype.provider_hierarchies = function (onSuccess) {
	var url = "http://" + this.apiHost + "/api/provider_hierarchies/" + this.apiVersion + ".json?callback=?";
	jQuery.getJSON(url, {}, onSuccess);
}

EolApi.prototype.hierarchies = function (id, onSuccess) {
	var url = "http://" + this.apiHost + "/api/hierarchies/" + this.apiVersion + "/" + id + ".json?callback=?";
	jQuery.getJSON(url, {}, onSuccess);
}

/* Gets search results and also adds the pages response (without media) for each result */
EolApi.prototype.searchHierarchyEntries = function (query, searchConfig, onSuccess) {
	if (typeof(searchConfig) == "function") {
		onSuccess = searchConfig; 
		searchConfig = {};
	}
	
	var pagesConfig = {
		images:0,
		videos:0,
		text:0,
		common_names:0
	}
	
	var that = this;
	var searchResponse;
	var pageResponseCount = 0;
	
	//a function for setting search result page data
	var setPage = function (index, searchResult) {
		that.pages(searchResult.id, pagesConfig, function (page) {
			searchResult.page = page;

			pageResponseCount++;
			if (pageResponseCount === searchResponse.results.length) {
				onSuccess(searchResponse);
			}
		});
	}; 
	
	this.search(query, searchConfig, function (response) {
		if (response.results.length === 0) {
			onSuccess(response);
		}
		
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

/** Calls callback with the entire IUCN dataObject */
EolApi.prototype.getIucnStatus = function(node, callback) {
	var pagesConfig = {
		"text":75,
		"images":0,
		"videos":0,
		"subjects":"ConservationStatus",
		"details":1,
		"common_names":0,
		"vetted":1
	}

	this.pages(node.taxonConceptID, pagesConfig, function(json) {
		var iucn;
		
		if (json.dataObjects && json.dataObjects.length > 0) {
			iucn = jQuery.grep(json.dataObjects, function (dataObject) {
				return dataObject.rightsHolder == "International Union for Conservation of Nature and Natural Resources";
			})[0];
		}
		
		callback(iucn);
	});
}