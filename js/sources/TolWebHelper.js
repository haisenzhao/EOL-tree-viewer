/* Treemap template helper object for TolWeb */
function TolWebHelper() {
	this.helper = this,
	
	this.getRoot = function getRoot() {
		//assuming this is the <tree> element, return node
		return jQuery(this.data).children("tree").children("node");
	};
	
	this.displayableNode = function displayableNode() {
		return true;
	};
		
	this.getID = function getID() {
		return this.data.attr("ID");
	};

	this.getName = function getName() {
		var name = this.data.children("name").text(),
			children;
		
		if (name.indexOf("Node ") > -1) {
			return ""; //treat crap "Node X" names as no name
		}
		
		return name;
	};
	
	this.hasChildren = function hasChildren() {
		return this.data.children("nodes").length > 0;
	};
	
	this.getChildren = function getChildren() {
		var children = this.data.children("nodes").children("node"),
			childArray = [];
		children.each(function() {
			childArray.push(jQuery(this));
		});
		
		return childArray;
	};
	
	this.hasChildrenLocal = function hasChildrenLocal() {
		return this.data.children("nodes").children("node").length > 0
	};
	
	this.getChildrenAsync = function getChildrenAsync() {
		var defer = new jQuery.Deferred(),
			that = this;
		
		if (this.hasChildrenLocal()) {
			defer.resolve(this.getChildren());
		} else {
			//create a deferred that gets the node and returns the children
			params = {
					url:this.getURL(),
					mode:"native"
			}
			
			jQuery.get("proxy.php", params).done(function(subtree) {
				//TODO update parent's <NODES> element?
				defer.resolve(jQuery(subtree).children("tree").children("node").children("nodes").children("node"));
			});
		}

		return defer;
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
	
	this.getImage = function getImage() {
		//TODO
		return new Image();
	};
	
	this.getURL = function getURL(id) {
		id = id | this.getID();
		
		return "http://tolweb.org/onlinecontributors/app?service=external&page=xml/TreeStructureService&page_depth=1&node_id=" + id;
	}
}