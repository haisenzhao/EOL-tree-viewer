/* Treemap template helper object for TolWeb */
function TolWebHelper() {
	this.helper = this,
	
	this.displayableNode = function displayableNode() {
		return true;
	};
		
	this.getID = function getID() {
		return this.data.attr("ID");
	};

	this.getName = function getName() {
		return this.data.children("name").text();
	};
	
	this.hasChildren = function hasChildren() {
		return this.getChildren().length > 0;
	};
	
	this.getChildren = function getChildren() {
		var children = this.data.children("nodes").children("node"),
			childArray = [];
		children.each(function() {
			childArray.push(jQuery(this));
		});
		
		return childArray;
	};

	this.getAncestors = function getAncestors() {
		//TODO return in leaf-to-root order
		return [];
	};
	
	this.subtreeSize = function subtreeSize(node) {
		//TODO subtree size is not available in the response.  Just sum over the partial subtree that I have.  
		//For now, returning 1 + childcount so I can test this
		if (node) {
			return jQuery(node).tmplItem().getChildren().length + 1;
		} else {
			return this.getChildren().length + 1;
		}
	};
}