/* Treemap template helper object for EOL */
function EolTemplateHelper() {
	this.helper = this,
	
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
		return this.data.ancestors.reverse(); //reverse to leaf-to-root order
	};
	
	this.subtreeSize = function subtreeSize(node) {
		if (node) {
			return jQuery(node).tmplItem().data.total_descendants + 1;
		} else {
			return this.data.total_descendants + 1;
		}
	};
}