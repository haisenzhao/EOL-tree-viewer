function EolAdapter() {
	this.helper = this;
	
	this.getRoot = function getRoot(tree) {
		//the tree is the same as the root node, just return this node;  (other tree types will have to handle this differently)
		return tree;
	};
	
	this.displayableNode = function displayableNode(node) {
		return node && "total_descendants" in node; //if this is just a child stub, this will be undefined, and we can't map without area
	};
		
	this.getID = function getID(node) {
		return node.taxonID;
	};
	
	this.getURL = function getURL(node) {
		return EolAdapter.api.buildURL("hierarchy_entries", this.getID(node));
	}

	this.getName = function getName(node) {
		return node.scientificName;
	};
	
	this.hasChildren = function hasChildren(node) {
		return node.children.length > 0;
	};
	
	this.hasChildrenLocal = function hasChildrenLocal(node) {
		return node.children.length > 0 && this.displayableNode(node.children[0]); //if it has stats, it's the full node
	};
	
	this.getChildrenAsync = function getChildrenAsync(node) {
		var defer = new jQuery.Deferred();
		
		if (this.hasChildrenLocal(node)) {
			defer.resolve(node.children);
		} else {
			//create a deferred that gets this.api.hierarchySubtree(id, depth) and returns the children when it's done
			EolAdapter.api.hierarchySubtree(this.getID(node), 1).done(function(subtree) {
				node.children = subtree.children;
				defer.resolve(subtree.children);
			});
		}

		return defer;
	};

	this.getAncestors = function getAncestors(node) {
		//reverse to leaf-to-root order. Called on a slice(0) clone because reverse() modifies the original array.
		return node.ancestors.slice(0).reverse(); 
	};
	
	this.getVernacularName = function getVernacularName(node) {
		var language = "en", //TODO pull this out and make it settable
			vernacularNames = node.vernacularNames,
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
	};
	
	//override vole.TreeAdapter.prototype.matchEOLTaxonConceptID, since we already have it
	this.matchEOLTaxonConceptID = function(node) {
		return jQuery.Deferred().resolve(node.taxonConceptID);
	};
	
	this.getSubtreeSize = function(node) {
		//total_descendants does not include this node, but the media stats (total_descendants_with_text, etc) *do* appear to include it
		return node && node.total_descendants + 1;
	};
	
	this.getNumberOfLeaves = function(node) {
		//no way to determine this from the eol api response
		return 1;
	}
}

EolAdapter.prototype = new vole.TreeAdapter();
EolAdapter.api = new EolApi();
