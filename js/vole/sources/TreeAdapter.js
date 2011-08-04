vole.TreeAdapter = function () {
	this.helper = this;
}

vole.TreeAdapter.prototype.eolapi = new EolApi();

vole.TreeAdapter.prototype.getDataObjects = vole.TreeAdapter.prototype.eolapi.getDataObjects;

vole.TreeAdapter.prototype.matchEOLTaxonConceptID = function (node) {
	var deferred = new jQuery.Deferred(),
		query = this.getName(node);

	this.eolapi.search(query).done(function(response) {
		var results = response.results,
			exactMatches;
		
		if (results.length == 0) {
			node.taxonConceptID = null;
			deferred.resolve(null);
			return;
		}
		
		exactMatches = jQuery.grep(results, function(result, index) {
			return result.title === query;
		});
		
		if (exactMatches.length > 0) {
			node.taxonConceptID = exactMatches[0].id;
		} else {
			node.taxonConceptID = results[0].id;
		}
		
		deferred.resolve(node.taxonConceptID);
	});
	
	return deferred.promise();
}

//returns a jQuery(<img>) that will get updated once the url is returned by the eolapi
vole.TreeAdapter.prototype.getImage = function getImage(thumbnail) {
	var image = jQuery("<img src='images/ajax-loader.gif'>"),
		eolapi = this.eolapi;

	this.getImageURL(node, thumbnail).done(function(url) {
		image.attr("src", url);
	});
	
	return image[0];
};

vole.TreeAdapter.prototype.getImageURL = function (node, thumbnail) {
	var eolapi = this.eolapi,
		deferred = new jQuery.Deferred();

	this.getEOLPage(node).done(function(page) {
		var dataObject, url;
		
		if (!page) {
			deferred.resolve(null); //TODO this (and several other Deferred.resolve() calls) should probably have been a Deferred.reject()
			return;
		}
		
		dataObject = eolapi.getDataObjects("StillImage", page)[0];
		
		if (dataObject) {
			if (thumbnail) {
				url = dataObject.eolThumbnailURL;
			} else {
				url = dataObject.eolMediaURL || dataObject.mediaURL;
			}
		}
		
		deferred.resolve(url);
	});
	
	return deferred;
};

vole.TreeAdapter.prototype.getEOLPage = function (node) {
	var eolapi = this.eolapi,
		deferred = new jQuery.Deferred();
	
	if (node.page) {
		//shortcut if node.page already fetched
		return deferred.resolve(node.page);
	}
	
	this.matchEOLTaxonConceptID(node).done(function(taxonConceptID) {
		if (!taxonConceptID) {
			node.page = null;
			deferred.resolve(null);
		}
		
		eolapi.pages(taxonConceptID).done(function(page) {
			node.page = page;
			deferred.resolve(page);
		});
	});
	
	return deferred;
};