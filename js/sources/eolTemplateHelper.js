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

	this.reverse = function reverse(array) {
		//can't seem to call array.reverse directly from the template, but it works wrapped in this function.
		return array.reverse();
	};
}