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

EolApi.baseConfig = {
	key:"cf5cf04c752d2716f006872a898b1fa73ec9ba45"
}

HierarchyConfig.prototype = PagesConfig.prototype = EolApi.baseConfig;

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

EolApi.getJSONP = function (url, config, requestID) {
	var ajaxSettings = {
		cache:true,
		dataType:"jsonp", //appends the 'callback=?' param
		jsonpCallback:requestID, //renames the ? callback function in the 'callback=?' param, instead of the random names jQuery gives them.  Keeps URL same, allows caching.
		type:"GET",
		url:url,
		data:config,
	};
	
	var deferred = jQuery.ajax(ajaxSettings);
	
	return deferred;
};

EolApi.prototype.hierarchy_entries = function (taxonID) {
	//TODO handle unknown taxonIDs.  API responds with an http 200 OK, so I still have to check for errors on ajax 'success'. And it's in XML instead of json.  Response is like <response><error><message>Unknown identifier taxonID</message></error></response> 
	if (taxonID) {
		var url = "http://" + this.apiHost + "/api/hierarchy_entries/" + this.apiVersion + "/" + taxonID + ".json";
		return EolApi.getJSONP(url, this.hierarchyConfig, "hierarchy_entries" + taxonID);
	} else {
		return jQuery.Deferred().reject("invalid taxonID: " + taxonID);
	}
};

EolApi.prototype.pages = function (taxonConceptID, config) {
	if (taxonConceptID) {
		var url = "http://" + this.apiHost + "/api/pages/" + this.apiVersion + "/" + taxonConceptID + ".json";
		return EolApi.getJSONP(url, config, "pages" + taxonConceptID);
	} else {
		return jQuery.Deferred().reject("invalid taxonConceptID: " + taxonConceptID);
	}
};

EolApi.prototype.data_objects = function (objectID) {
	if (objectID) {
		var url = "http://" + this.apiHost + "/api/data_objects/" + this.apiVersion + "/" + objectID + ".json";
		return EolApi.getJSONP(url, EolApi.baseConfig,"data_objects" + objectID);
	} else {
		return jQuery.Deferred().reject("invalid objectID: " + objectID);
	}
};

EolApi.prototype.search = function (query, config) {
	if (!query) return jQuery.Deferred().reject("no query");
	config = config || EolApi.baseConfig;
	
	var url = "http://" + this.apiHost + "/api/search/" + this.apiVersion + "/" + query + ".json";
	return EolApi.getJSONP(url, config, "search" + query);
};

EolApi.prototype.provider_hierarchies = function () {
	var url = "http://" + this.apiHost + "/api/provider_hierarchies/" + this.apiVersion + ".json";
	return EolApi.getJSONP(url, EolApi.baseConfig, "provider_hierarchies");
}

EolApi.prototype.hierarchies = function (id) {
	if(id) {
		var url = "http://" + this.apiHost + "/api/hierarchies/" + this.apiVersion + "/" + id + ".json";
		return EolApi.getJSONP(url, EolApi.baseConfig, "hierarchies" + id);
	} else {
		return jQuery.Deferred().reject("invalid id: " + id);
	}
}

/* returns a jQuery.Deferred promise that passes the root node to the promise.done() */
EolApi.prototype.hierarchySubtree = function (taxonID, level) {
	var defer = jQuery.Deferred();
	var api = this;
	
	api.hierarchy_entries(taxonID)
		.done(function(node) {
			var childRequests = [];
			
			var adopt = function (child) {
				node.children.push(child);
			}
	
			if (level > 0) {
				var children = node.children;
				node.children = []; //child stub nodes will be replaced by actual nodes in adopt()
				childRequests = jQuery.map(children, function (child) { 
					return api.hierarchySubtree(child.taxonID, level - 1).done(adopt);
				});
			}
	
			jQuery.whenArray(childRequests)
				.done(function() { defer.resolve(node) })
				.fail(function(args) { defer.reject(node, taxonID, level, args) });
		})
		.fail(function(args) { 
			defer.reject(taxonID, level, args)
		});
	
	return defer.promise();
};

jQuery.extend({
	whenArray: function (deferreds) {
		//have to use apply to give when() an array of deferred args
		return jQuery.when.apply(jQuery, deferreds);
	}
});


/* Gets search results and also adds the pages response (without media) for each result */
//TODO change this to return a jQuery.Deferred instead of taking a callback
EolApi.prototype.searchPages = function (query, searchConfig, onSuccess) {
	searchConfig = searchConfig || EolApi.baseConfig;
	
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
		that.pages(searchResult.id, pagesConfig).done(function (page) {
			searchResult.page = page;

			pageResponseCount++;
			if (pageResponseCount === searchResponse.results.length) {
				onSuccess(searchResponse);
			}
		});
	}; 
	
	this.search(query, searchConfig).done(function (response) {
		if (response.results.length === 0) {
			onSuccess(response);
		}
		
		searchResponse = response;
		jQuery.each(response.results, setPage);
	});
};

EolApi.prototype.decorateNode = function (node) {

	var append = function (json) {
		//just appending the whole dataObject to the node
		node.image = jQuery.grep(json.dataObjects, function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/StillImage";
		})[0];
		
		node.text = jQuery.grep(json.dataObjects, function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/Text";
		})[0];
		
		node.vernacularNames = json.vernacularNames;
		node.apiContentFetched = true;
	};
	
	//note this deferred returns the pages response, not the whole node
	//TODO make a new jQuery.Deferred to return the node, I think that would be expected.  Right now this isn't an issue, since callers ignore the parameter and just deal with their reference to the decorated node. 
	return this.pages(node.taxonConceptID, this.pagesConfig).done(append); 
};

/** Calls callback with the entire IUCN dataObject */
//TODO change this to returning a jQuery.Deferred instead of taking a callback
EolApi.prototype.getIucnStatus = function(node, callback) {
	var pagesConfig = {
		"text":75,
		"images":0,
		"videos":0,
		"subjects":"ConservationStatus",
		"details":1,
		"common_names":0,
		"vetted":1,
		"key":"cf5cf04c752d2716f006872a898b1fa73ec9ba45"
	}

	this.pages(node.taxonConceptID, pagesConfig).done(function(json) {
		var iucn;
		
		if (json.dataObjects && json.dataObjects.length > 0) {
			iucn = jQuery.grep(json.dataObjects, function (dataObject) {
				return dataObject.rightsHolder == "International Union for Conservation of Nature and Natural Resources";
			})[0];
		}
		
		callback(iucn);
	});
}

EolApi.prototype.stump = function (onSuccess) {
	var defer = jQuery.Deferred();
	
	var root = {
		id: "HOME",
		name: "Classifications",
		children: [],
		data: {
			apiContentFetched: true
		}
	};

	var api = this;
	
	/*
	 * adds some fields to a hierarchy to make it a usable treemap node, then
	 * adds the hierarchy as a child of root
	 */
	var prep = function(hierarchy) {
		var metadata = EolApi.hierarchyData[hierarchy.title];
		
		hierarchy.id = metadata ? metadata.short : "hierarchy" + hierarchy.title;
		hierarchy.name = hierarchy.title;
		hierarchy.children = hierarchy.roots; 
		
		hierarchy.data = {
			image: {mediaURL:"images/tree_icon.svg"} //default image
		}
		
		if (metadata) {
			hierarchy.image = metadata.image;
			hierarchy.text = metadata.text;
		}

		hierarchy.apiContentFetched = true;
		root.children.push(hierarchy);
	};
	
	api.provider_hierarchies()
		.done(function(response) {
			
			//response is an array of {label, id}.  Make an array of deferred requests for the hierarchies.
			var hierarchyRequests = jQuery.map(response, function (hierarchy) { 
				return api.hierarchies(hierarchy.id).done(prep);
			});
	
			jQuery.whenArray(hierarchyRequests)
				.done(function() { defer.resolve(root) })
				.fail(function(args) { defer.reject(args) });
		})
		.fail(function(args) { 
			defer.reject(args) 
		});
	
	return defer.promise();	
};

//some more info to dress up the currently known hierarchy nodes.  (new ones will get a placeholder image but no description.)
//ID numbers may not remain the same.  Metalmark, for example, has gone through several ID changes
EolApi.hierarchyData = {
	"Species 2000 & ITIS Catalogue of Life: Annual Checklist 2010": {
		id:529,
		name:"Species 2000 & ITIS Catalogue of Life: Annual Checklist 2010",
		short:"COL",
		image:{mediaURL:"images/col_dvd_front_cover.jpg"},
		text:{description:"<p><b>CoL</b> <a href='http://www.catalogueoflife.org/'>http://www.catalogueoflife.org/</a><br>The Catalogue of Life Partnership (CoLP) is an informal partnership dedicated to creating an index of the world’s organisms, called the Catalogue of Life (CoL). The CoL provides different forms of access to an integrated, quality, maintained, comprehensive consensus species checklist and taxonomic hierarchy, presently covering more than one million species, and intended to cover all know species in the near future. The Annual Checklist EOL uses contains substantial contributions of taxonomic expertise from more than fifty organizations around the world, integrated into a single work by the ongoing work of the CoLP partners. EOL currently uses the CoL Annual Checklist as its taxonomic backbone.</p>"}
	},
	"NCBI Taxonomy": {
		id:441,
		name:"NCBI Taxonomy",
		short:"NCBI",
		image:{mediaURL:"images/white_ncbi.png"},
		text:{description:"<p><b>NCBI</b> <a href='http://www.ncbi.nlm.nih.gov/'>http://www.ncbi.nlm.nih.gov</a><br>As a U.S. national resource for molecular biology information, NCBI's mission is to develop new information technologies to aid in the understanding of fundamental molecular and genetic processes that control health and disease. The NCBI taxonomy database contains the names of all organisms that are represented in the genetic databases with at least one nucleotide or protein sequence.</p>"}
	},
	"IUCN Red List (Species Assessed for Global Conservation)": {
		id:144,
		name:"IUCN Red List (Species Assessed for Global Conservation)",
		short:"IUCN",
		image: {mediaURL:"images/iucn_high_res.jpg"},
		text: {description:"<p><b>IUCN</b> <a href='http://www.iucn.org//'>http://www.iucn.org/</a><br>International Union for Conservation of Nature (IUCN) helps the world find pragmatic solutions to our most pressing environment and development challenges. IUCN supports scientific research; manages field projects all over the world; and brings governments, non-government organizations, United Nations agencies, companies and local communities together to develop and implement policy, laws and best practice. EOL partnered with the IUCN to indicate status of each species according to the Red List of Threatened Species.</p>"}
	},
	"FishBase (Fish Species)": {
		id:143,
		name:"FishBase (Fish Species)",
		short:"FishBase",
		image: {mediaURL:"images/fblogo.jpg"},
		text: {description:"<p><b>FishBase</b> <a href='http://www.fishbase.org/'>http://www.fishbase.org/</a><br>FishBase is a global information system with all you ever wanted to know about fishes. FishBase is a relational database with information to cater to different professionals such as research scientists, fisheries managers, zoologists and many more. The FishBase Website contains data on practically every fish species known to science. The project was developed at the WorldFish Center in collaboration with the Food and Agriculture Organization of the United Nations and many other partners, and with support from the European Commission. FishBase is serving information on more than 30,000 fish species through EOL.</p>"}
	},
	"Integrated Taxonomic Information System (ITIS)": {
		id:107,
		name:"Integrated Taxonomic Information System (ITIS)",
		short:"ITIS",
		image:{mediaURL:"images/itis_circle_image.jpg"},
		text: {description:"<p><b>ITIS</b> <a href='http://www.itis.gov/'>http://www.itis.gov/</a><br />The Integrated Taxonomic Information System (ITIS) is a partnership of federal agencies and other organizations from the United States, Canada, and Mexico, with data stewards and experts from around the world (see http://www.itis.gov). The ITIS database is an automated reference of scientific and common names of biota of interest to North America . It contains more than 600,000 scientific and common names in all kingdoms, and is accessible via the World Wide Web in English, French, Spanish, and Portuguese (http://itis.gbif.net). ITIS is part of the US National Biological Information Infrastructure (http://www.nbii.gov).</p>"}
	},
	"AntWeb (Ant Species)": {
		id:121,
		name:"AntWeb (Ant Species)",
		short:"AntWeb",
		image:{mediaURL:"images/antweb_logo.png"},
		text: {description:"<p><b>AntWeb</b> <a href='http://www.antweb.org/'>http://www.antweb.org/</a><br />AntWeb is generally recognized as the most advanced biodiversity information system at species level dedicated to ants. Altogether, its acceptance by the ant research community, the number of participating remote curators that maintain the site, number of pictures, simplicity of web interface, and completeness of species, make AntWeb the premier reference for dissemination of data, information, and knowledge on ants. AntWeb is serving information on tens of thousands of ant species through the EOL.</p>"}
	},
	"WORMS Species Information (Marine Species)": {
		id:123,
		name:"WORMS Species Information (Marine Species)",
		short:"WoRMS",
		image:{mediaURL:"images/wormsbanner1.jpg"},
		text: {description:"<p><b>WoRMS</b> <a href='http://www.marinespecies.org/'>http://www.marinespecies.org/</a><br />The aim of a World Register of Marine Species (WoRMS) is to provide an authoritative and comprehensive list of names of marine organisms, including information on synonymy. While highest priority goes to valid names, other names in use are included so that this register can serve as a guide to interpret taxonomic literature.</p>"}
	},
	"Index Fungorum": {
		id:596,
		name:"Index Fungorum",
		short:"Index Fungorum",
		image:{mediaURL:"images/LogoIF.gif"},
		text: {description:"<p><b>Index Fungorum</b> <a href='http://www.indexfungorum.org/'>http://www.indexfungorum.org/</a><br />The Index Fungorum, the global fungal nomenclator coordinated and supported by the Index Fungorum Partnership (CABI, CBS, Landcare Research-NZ), contains names of fungi (including yeasts, lichens, chromistan fungal analogues, protozoan fungal analogues and fossil forms) at all ranks. </p>"}
	},
	"Metalmark Moths of the World": {
		id:623,
		name:"Metalmark Moths of the World",
		short:"Metalmark",
		image:{mediaURL:"http://content7.eol.org/content/2010/07/13/04/52919_large.jpg"},
		text: {description:"<p><b>Metalmark Moths of the World</b> <a href='http://choreutidae.lifedesks.org/'>http://choreutidae.lifedesks.org/</a><br />Metalmark moths (Lepidoptera: Choreutidae) are a poorly known, mostly tropical family of microlepidopterans.  The Metalmark Moths of the World LifeDesk provides species pages and an updated classification for the group.</p>"}
	}
}
