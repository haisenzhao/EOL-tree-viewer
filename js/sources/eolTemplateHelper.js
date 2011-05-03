/* Treemap template helper object for EOL */
function EolTemplateHelper() {
	this.helper = this,
	this.api = new EolApi();
	
	this.displayableNode = function displayableNode() {
		return this.data.total_descendants; //if this is just a child stub, this will be undefined, and we can't map without area
	};
		
	this.getID = function getID() {
		return this.data.taxonID;
	};

	this.getName = function getName() {
		return this.data.scientificName;
	};
	
	this.hasChildren = function hasChildren() {
		return this.data.children.length > 0;
	};
	
	this.getChildren = function getChildren() {
		return this.data.children;
	};

	this.getAncestors = function getAncestors() {
		//reverse to leaf-to-root order. Called on a slice(0) clone because reverse() modifies the original array.
		return this.data.ancestors.slice(0).reverse(); 
	};
	
	this.getVernacularName = function getVernacularName() {
		var language = "en", //TODO pull this out and make it settable
			vernacularNames = this.data.vernacularNames,
			anyNames,
			preferredName,
			nameObj;

		anyNames = jQuery.grep(vernacularNames, function (element) {
			return element.language === language;
		});
			
		if (anyNames) {
			preferredName = jQuery.grep(anyNames, function (element) {
				return element.eol_preferred;
			})[0];
		}
		
		nameObj = preferredName || 
				anyNames && anyNames[0];
		
		return nameObj && nameObj.vernacularName || "";
	}
	
	this.getDataObjects = function(dcmitype, page) {
		page = page || this.data;
		
		return jQuery.grep(page.dataObjects, function (item) {
			return item.dataType === "http://purl.org/dc/dcmitype/" + dcmitype;
		});
	}
	
	this.getImage = function(node, thumbnail) {
		var data = node && jQuery(node).tmplItem().data || this.data,
			that = this,
			image;
		
		image = jQuery("<img src='images/ajax-loader.gif'>");
		
		this.api.pages(data.taxonConceptID).done(function (page) {
			var dataObject, url;
			
			dataObject = that.getDataObjects("StillImage", page)[0];
			
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
		
		return image[0]; //returns a placeholder for now, but updates its src when the pages API call comes back
	}
}
