vole.TreeAdapter = function () {
	this.helper = this;
}

vole.TreeAdapter.prototype.eolapi = new EolApi();

vole.TreeAdapter.prototype.getDataObjects = vole.TreeAdapter.prototype.eolapi.getDataObjects;

//Template helper method. (will be added to a jQuery template item.  this == a tmplItem)
vole.TreeAdapter.prototype.matchEOLTaxonConceptID = function() {
	var deferred = new jQuery.Deferred(),
		query = this.getName(),
		node = this.data;

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

//Template helper method. (will be added to a jQuery template item.  this == a tmplItem)
//returns a jQuery(<img class='resizable'>) that will get updated once the url is returned by the eolapi
vole.TreeAdapter.prototype.getImage = function getImage(thumbnail) {
	var image = jQuery("<img src='images/ajax-loader.gif'>"),
		eolapi = this.eolapi;

	this.getEOLPage().done(function(page) {
		var dataObject, url;
		
		if (!page) {
			image.attr("src", "images/no_image.png");
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
		
		if (url) {
			image.addClass("resizable"); //the original (placeholder) image wasn't marked as resizable yet, because that's ugly
			image.attr("src", url);
		} else {
			image.attr("src", "images/no_image.png");
		}
	});
	
	return image[0];
};

//Template helper method. (will be added to a jQuery template item.  this == a tmplItem)
vole.TreeAdapter.prototype.getEOLPage = function getEOLPage() {
	var node = this.data,
		eolapi = this.eolapi,
		deferred = new jQuery.Deferred();
	
	if (node.page) {
		//shortcut if this.data.page already fetched
		return deferred.resolve(node.page);
	}
	
	this.matchEOLTaxonConceptID().done(function(taxonConceptID) {
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