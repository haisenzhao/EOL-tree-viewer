var vole = {
	setTreeMap: function(treemap) {
		this.tm = treemap;
		
		treemap.addViewChangeHandler(this.viewChangeHandler);
		treemap.addNodeSelectHandler(this.updateDetail);
		treemap.addNodeSelectHandler(this.updateStats);
	},
	
	hashChangeHandler: function() {
		if (location.hash) {
			vole.tm.view(location.hash.slice(1));
		} else {
			//without hash, show splash and load HOME node behind it
			var rootElement = jQuery("#" + vole.tm.rootId);
			var overlay = jQuery("#splash");
			overlay.width(rootElement.innerWidth()).height(rootElement.innerHeight()).show();
			overlay.click(function() {
				jQuery(this).fadeOut();
			});
			
			jQuery("#splash a").click(function() {window.open(this.href); return false;}); //prevent cilcks on links from hiding the splash screen
			
			
			location.hash = "HOME"; //By default redirect to the root
		}
	},

	viewChangeHandler: function (node) {
		document.title = vole.tm.shownTree.name;
	},
	
	updateDetail: function (node) {
		var language = "en";
		
		jQuery("#detail-title").empty();
		jQuery("#detail-subtitle").empty();
		jQuery("#detail figure div.image").empty();
		jQuery("#detail figure figcaption").empty();
		jQuery("#detail div.description h2").empty();
		jQuery("#detail div.description div").empty();
		
		if (node != null) {
			jQuery("#detail-title").html(node.name);

			if(node.vernacularNames) {
				var commonName = jQuery.grep(node.vernacularNames, function (element) {
					return element.language === language;
				})[0];
				
				if (commonName) {
					jQuery("#detail-subtitle").html(commonName.vernacularName);
				}
			}	

			if (node.image) {
				var url = node.image.eolMediaURL || node.image.mediaURL;
				jQuery("#detail figure div.image").html("<img src=" + url + ">");
				//jQuery("#detail figure figcaption").html(node.image.taxonConcepts[0].scientificName); //TODO get the full dataobject and use the taxonConcept for the caption.  also, pick the taxonConcept for the current hierarchy, instead of just using the first one
				jQuery("#detail figure figcaption").html(node.image.title);
			}
			
			if (node.text) {
				if (node.text.agents) {
					var providers = jQuery.grep(node.text.agents, function (agent){
						return agent.role === "provider";
					});
					if (providers[0]) {
						jQuery("#detail div.description h2").html("From " + providers[0].full_name + ":");
					}
					
				}
				var description = node.text.description.replace(/&nbsp;/gm, " "); //remove ugly whitespace (Animal Diversity Web content, for example)
				jQuery("#detail div.description div").html(description);
			} else if (node.taxonConceptID && node.apiContentFetched) {
				var addTextURL = "http://www.eol.org/pages/" + node.taxonConceptID;
				jQuery("#detail div.description div").html("No general description is available. <a href='" + addTextURL + "' target='_blank' >Click here</a> to visit this page on the EOL and then click \"Add New Content\" to contribute an overview to this page.");
			}
		}
	},
	
	updateStats: function (node) {
		//note: adding 1 to node.total_descendants everywhere because node.total_descendants_with_text and total_descendants_with_images include the node itself.
		if (node != null) {
			if (node.total_descendants) {
				jQuery('#total_descendants').text(node.total_descendants + 1);
				
				node.total_descendants_with_text && jQuery('#total_descendants_with_text').text(node.total_descendants_with_text).append(" (" + Math.round(100 * node.total_descendants_with_text / (node.total_descendants + 1)) + "%)");
				node.total_descendants_with_images && jQuery('#total_descendants_with_images').text(node.total_descendants_with_images).append(" (" + Math.round(100 * node.total_descendants_with_images / (node.total_descendants + 1)) + "%)");
			} else {
				jQuery('#total_descendants').empty();
				jQuery('#total_descendants_with_text').empty();
				jQuery('#total_descendants_with_images').empty();
			}
			
			(node.total_trusted_text && jQuery('#total_trusted_text').text(node.total_trusted_text)) || jQuery('#total_trusted_text').empty();
			(node.total_unreviewed_text && jQuery('#total_unreviewed_text').text(node.total_unreviewed_text)) || jQuery('#total_unreviewed_text').empty();
			(node.total_trusted_images && jQuery('#total_trusted_images').text(node.total_trusted_images)) || jQuery('#total_trusted_images').empty();
			(node.total_unreviewed_images && jQuery('#total_unreviewed_images').text(node.total_unreviewed_images)) || jQuery('#total_unreviewed_images').empty();
		}
	},
	
	doSearch: function (query, page) {
		page = page || 1;
		
		if (query) {
			jQuery("#search-results").html("<img src='images/ajax-loader.gif' />");
			
			//a function for filtering taxonConcepts below
			var nameAccordingTo = vole.tm.currentHierarchyName();
			var hierarchyMatch = function (taxonConcept) {
				return taxonConcept.nameAccordingTo === nameAccordingTo;
			};
			
			var matchRegex = new RegExp(query,"gim"); //to highlight matches in the returned content
			
			searchConfig = {"page":page};
			
			var api = new EolApi();
			api.searchPages(query, searchConfig, function (json) {
				//TODO rewrite this so it doesn't build so much html on every search.
				jQuery("#search-results").empty();
				
				if (json.results.length === 0) {
					jQuery("#search-results").html("<h3>No matches found</h3>");
					return;
				}
				
				var nav = jQuery("<div class='nav'>").appendTo("#search-results");
				var prev = jQuery("<span class='prev inactive'>prev</span>").appendTo(nav);
				nav.append(page + " of " + Math.ceil(json.totalResults / json.itemsPerPage));
				var next = jQuery("<span class='next inactive'>next</span>").appendTo(nav);
				
				if (json.previous) {
					prev.removeClass("inactive").addClass("active").click(function(event){
						doSearch(query, page - 1);
					});
				}
				
				if (json.next) {
					next.removeClass("inactive").addClass("active").click(function(event){
						doSearch(query, page + 1);
					});
				}
				
				var thisClassificationMsg = jQuery("<div>").text("No results found in the current classification").appendTo("#search-results");
				var thisClassificationResults = jQuery("<ul>").appendTo("#search-results");
				var otherClassificationMsg = jQuery("<div>").text("No results found in other classifications").appendTo("#search-results");
				var otherClassificationResults = jQuery("<ul>").appendTo("#search-results");
				var noClassificationMsg = jQuery("<div>").html("<h3>These results do not appear in any classification:</h3>").appendTo("#search-results").hide();
				var noClassificationResults = jQuery("<ul>").appendTo("#search-results");
				var hoverDetails = jQuery("<div id='search-result-details'>").appendTo("#search-results");
				
				jQuery.each(json.results, function (index, result) {
					result.content = result.content.replace(matchRegex, "<span class='match-text'>" + query + "</span>");

					var hoverIn = function (eventObject) {
						hoverDetails.html("<h3>Content matched:</h3>").append(result.content);
						hoverDetails.show();
					};

					var hoverOut = function (eventObject) {
						hoverDetails.hide();
					};

					if (result.page) {
						var match = jQuery.grep(result.page.taxonConcepts, hierarchyMatch);
						var item;
						
						if (match.length > 0) {
							thisClassificationResults.show();
							thisClassificationMsg.html("<h3>Results in the current classification:</h3>");
							var link = jQuery("<a href=#" + match[0].identifier + ">" + match[0].scientificName + "</a>");
							item = jQuery("<li class='same-classification-result'>").append(link).appendTo(thisClassificationResults);
	
						} else if (result.page.taxonConcepts && result.page.taxonConcepts.length > 0) {
							otherClassificationResults.show();
							otherClassificationMsg.html("<h3>Results in other classifications:</h3>");
							item = jQuery("<li class='other-result'>").append(result.title).appendTo(otherClassificationResults);
							var links = jQuery("<ul>").appendTo(item);
							jQuery.each(result.page.taxonConcepts, function(index, taxonConcept) {
								links.append("<li><a href=#" + taxonConcept.identifier + ">" + taxonConcept.nameAccordingTo + "</a></li>");
							});
						}
					} else {
						//Has no taxonConcepts == appears in no classifications?
						noClassificationMsg.show();
						item = jQuery("<li class='other-result'>").append(result.title).appendTo(noClassificationResults);
					}

					if (item) {
						item.hover(hoverIn, hoverOut);
					}
				});
			});
		}
	},
	
	makeTabClickHandler: function(tabset) {
		return function () {
			tabset.removeClass("selected");
			jQuery(this).addClass("selected");
			jQuery("#right > div").hide().filter(this.hash).show();
			return false;
		};
	}

}

jQuery(document).ready(function() {
	vole.setTreeMap(new EOLTreeMap(jQuery("#thejit")[0]));
	jQuery("#help").html(EOLTreeMap.help);
	jQuery("#options").append(vole.tm.getOptionsForm());
	
	jQuery(window).bind( 'hashchange', vole.hashChangeHandler);
	jQuery(window).trigger( 'hashchange' );
	
	var tabs = jQuery("#right .tab");
	tabs.click(vole.makeTabClickHandler(tabs));
	tabs.filter(":first").click();
	                
    jQuery("#thejit").mousewheel(function(objEvent, intDelta){
		jQuery("#detail")[0].scrollTop -= 10*intDelta;
    });

	jQuery("#search").submit(function () {
		var query = jQuery("#search input").val();
		var page = 1;
		vole.doSearch(query, page);
	});
	
	jQuery(window).resize(function() {
		vole.tm.view(null);
		//TODO update right panel div sizes to fit remaining height
	});
});
