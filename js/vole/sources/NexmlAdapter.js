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
		var tree = this.data.parent(),
			childEdges = tree.children("edge[source=" + this.data.attr('id') + "]");
		
		return childEdges.length > 0;
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
		var tree = this.data.parent(),
			node = this.data,
			parent,
			ancestors = [];
		
		parent = this.getParent(node, tree);
		while (parent) {
			if (parent.attr("label")) {
				ancestors.unshift(parent);
			}
			parent = this.getParent(parent, tree);
		}
		
		return ancestors.reverse();
	};
	
	this.getParent = function (node, tree) {
		var parentEdge = tree.children("edge[target=" + node.attr('id') + "]"),
			parent;
		
		if (parentEdge.length > 0) {
			parent = tree.children("node[id=" + parentEdge.attr('source') + "]");
			return parent;
		} else {
			return null;
		}
	}
	
	this.subtreeSize = function subtreeSize(node) {
		//TODO
	};
	
	this.getURL = function getURL(id) {
		return "";
	};
	
	this.matchEOLTaxonConceptID = function() {
		var deferred = new jQuery.Deferred(),
			eolapi = this.eolapi,
			node = this.data;

		if (typeof node.taxonConceptID != "undefined") {
			deferred.resolve(node.taxonConceptID);
			return deferred;
		}
		
		this.getNcbiId().done(function(ncbiId) {
			var searchURL;
			
			if (!ncbiId) {
				node.taxonConceptID = null;
				deferred.resolve(null);
				return;
			}
			
			searchURL = eolapi.buildURL("search_by_provider", ncbiId) + "?hierarchy_id=441";

			vole.get(searchURL).done(function(response) {
				if (response.length > 0) {
					node.taxonConceptID = response[0].eol_page_id;
					deferred.resolve(node.taxonConceptID);
				}
			});
		});

		return deferred.promise();
	};
	
	//returns a deferred, which resolves with the current node's NCBI ID
	this.getNcbiId = function() {
		var deferred = new jQuery.Deferred(),
			ubioURL = this.getUbioURL();
		
		if(ubioURL) {
			vole.get(ubioURL).done(function(namebank) {
				var ncbiURL, ncbiId;
				
				//TODO move this function out to a closure or util object or something
				function getParam(url, param) {
					var start, end;
					
					start = url.indexOf("&" + param + "=");
					
					if (start < 0) {
						start = url.indexOf("?" + param + "=");
					}
					
					if (start < 0) {
						return null;
					}
					
					start = url.indexOf("=", start) + 1;
					end = url.indexOf("&", start);
					return url.slice(start, end);
				}
				
				ncbiURL = jQuery(namebank).children().children().children("gla\\:mapping[rdf\\:resource*='http://www.ncbi.nlm.nih.gov']").attr("rdf:resource");
				
				if (ncbiURL) {
					//TODO: this name has no ncbi mapping. May be able to find a synonym or lexical variant with an ncbi url.
					ncbiId = getParam(ncbiURL, "id");
				}
				
				deferred.resolve(ncbiId);
			});
		} else {
			deferred.resolve(null);
		}
		
		return deferred.promise()
	};
	
	this.getUbioURL = function () {
		var node = this.data,
			id = node.attr("otu"),
			doc = node.closest("nex\\:nexml"),
			otu,
			url;
		
		if (id) {
			otu = doc.children("otus").children("otu[id=" + id + "]");
			url = otu.children("meta[rel='skos:closeMatch'][href*='urn:lsid:ubio.org:namebank:']").attr("href");
		}
		
		return url;
	};
}

NexmlAdapter.prototype = new vole.TreeAdapter();

