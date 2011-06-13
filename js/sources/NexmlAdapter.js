function NexmlAdapter() {
	this.helper = this;
	
	this.getRoot = function getRoot() {
		//only give the first root of the first tree.  TODO? deal with multiple trees and/or multiple roots
		var tree, root;
		
		if (this.data[0] && this.data[0].localName === "node") {
			//trying to view a node instead of the whole tree, just return it
			return this.data;
		}
		
		tree = jQuery(this.data).find("tree").first(),
		root = tree.children("node[root='true']").first();
		
		// root attribute is optional, there may be no marked root
		if (root.length == 0) {
			var nodes = tree.children("node"),
				length = nodes.length;
			
			for (i = 0; i < length; i++) {
					var node = jQuery(nodes[i]),
					parentEdge = tree.children("edge[target=" + node.attr('id') + "]"),
					parent;
					
				if (parentEdge.length == 0) {
					return node;
				}
			
				//parent = tree.children("node[id=" + parentEdge.attr('source') + "]");
			}
		}
		
		return root;
	};
	
	this.displayableNode = function displayableNode() {
		return true;
	};
		
	this.getID = function getID() {
		return this.data.attr("id");
	};

	this.getName = function getName() {
		var label = this.data.attr("label") || "";
		
		return label;
	};
	
	this.hasChildren = function hasChildren() {
		return true; //TODO find out how to get to the edges of this tree
	};
	
	this.getChildren = function getChildren() {
		var tree = this.data.parent(),
			childEdges = tree.children("edge[source=" + this.data.attr('id') + "]"),
			childNodes = [];
		
		childEdges.each(function(index, edge) {
			var child = tree.children("node[id=" + jQuery(edge).attr('target') + "]").first();
			childNodes.push(child);
		});
		
		return childNodes;
	};
	
	this.hasChildrenLocal = function hasChildrenLocal() {
		return this.hasChildren();
	};
	
	this.getChildrenAsync = function getChildrenAsync() {
		var defer = new jQuery.Deferred(),
			that = this;
		
		return new jQuery.Deferred().resolve(this.getChildren());
	};

	this.getAncestors = function getAncestors() {
		//TODO return in leaf-to-root order
		return [];
	};
	
	this.subtreeSize = function subtreeSize(node) {
		//TODO
	};
	
	this.getURL = function getURL(id) {
		return "";
	}
}

NexmlAdapter.prototype = new vole.TreeAdapter();