(function () {
	var api = new EolApi(),
		language = "en",
		selectionFrozen = false;
		selectedElement = {};

	/*********************
	 * Compile templates *
	 *********************/
	jQuery.template("right", 
		"<div id='right'>"+
			"<ul id='tabs'>"+
				"<li><a class='tab' href='#detail'>Detail</a></li>"+
				"<li><a class='tab' href='#statistics'>Stats</a></li>"+
				"<li><a class='tab' href='#search'>Search</a></li>"+
				"<li><a class='tab' href='#options'>Options</a></li>"+
				"<li><a class='tab' href='#help'>Help</a></li>"+
			"</ul>"+
	
			"<div id='panels'>"+
				"{{tmpl 'right.detail'}}"+
				"{{tmpl 'right.statistics'}}"+
				"{{tmpl 'right.search'}}"+
				"{{tmpl 'right.options'}}"+
				"{{tmpl 'right.help'}}"+
			"</div>"+
		"</div>");
	
	//Takes an EOL pages API response, preferably with at least one image and one text dataObject
	jQuery.template("right.detail", 
		"<div class='panel' id='detail'>"+
			"<p class='help'>Move the mouse pointer over a node in the left panel to see images "+
			"and descriptions.</p>"+
		
			"{{if scientificName}}"+
				"<h1 id='detail-title'>${scientificName}</h1>"+
				"<h2 id='detail-subtitle'>${$item.getVernacularName()}</h2>"+
		
				"{{tmpl($item.getDataObjects('StillImage', $data)[0]) 'right.detailImage'}}"+
				"{{tmpl($item.getDataObjects('Text', $data)[0]) 'right.detailDescription'}}"+
			"{{/if}}"+
		"</div>");
	
	// Takes a dataObject from the EOL data_objects or pages API 
	jQuery.template("right.detailImage", 
		"{{if eolMediaURL}}"+
			"<figure>"+
				"<div class=image>"+
					"<img src='${eolMediaURL}'/>"+
				"</div>"+
				"<figcaption>"+
					"${title}</br>"+
					"{{if agents && agents[0]}}"+
						"${agents[0].role}: ${agents[0].full_name}"+
					"{{/if}}"+
				"</figcaption>"+
			"</figure>"+
		"{{/if}}");
	
	// Takes a dataObject from the EOL data_objects or pages API 
	jQuery.template("right.detailDescription", 	
		"{{if description}}"+
			"<div class='description'>"+
				"<h2>${title}</h2>"+
				"<div>{{html description}}</div>"+
			"</div>"+
		"{{/if}}");

	// Takes a hierarchy_entries API response
	jQuery.template("right.statistics",
		"<div class='panel' id='statistics'>"+
			"<p class='help'>Move the mouse pointer over a taxon in the left panel to see what "+
			"content the EOL has for that clade.</p>"+
			"<ul>"+
				"<li>descendants: ${total_descendants}</li>"+
				"<ul>"+
					"<li>descendants with text: ${total_descendants_with_text}</li>"+
					"<li>descendants with images: ${total_descendants_with_images}</li>"+
				"</ul>"+
				"<li>text</li>"+
				"<ul>"+
					"<li>trusted text: ${total_trusted_text}</li>"+
					"<li>unreviewed text: ${total_unreviewed_text}</li>"+
				"</ul>"+
				"<li>images</li>"+
				"<ul>"+
					"<li>trusted images: ${total_trusted_images}</li>"+
					"<li>unreviewed images:${total_unreviewed_images}</li>"+
				"</ul>"+
			"</ul>"+
		"</div>");
	
	jQuery.template("right.search",
		"<div class='panel' id='search'>"+
			"<p>Enter a common or scientific name in the box below to search.</p>"+
			"<form onsubmit='return false;'>"+
				"Name: <input type='text' name='query'/>"+
			"</form>"+
		
			"{{if results}}"+
				"<div id='search-results'>"+
					"{{if (results.length === 0)}}"+
						"<h3>No matches found</h3>"+
					"{{else}}"+
						"{{tmpl($data) 'right.searchResults'}}"+
					"{{/if}}"+
				"</div>"+
			"{{/if}}"+
		"</div>");
		
	jQuery.template("right.searchResults",
		"{{tmpl($data) 'right.searchNav'}}"+
		"<ul class='result-page'>"+
			"{{tmpl(results) 'right.searchResult'}}"+
		"</ul>");
		
	jQuery.template("right.searchNav",
		"<div class='search-nav'>"+
			"{{if previous}}<a class='search-prev' href=${previous}>prev</span> {{/if}}"+
			
			"${startIndex} to ${startIndex + results.length - 1} of ${totalResults} results"+
			
			"{{if next}}<span class='search-next' href=${next}>next</span>{{/if}}"+
		"</div>");
	
	jQuery.template("right.searchResult",
		"<li class='result'>${page.scientificName}"+
			"{{if page.taxonConcepts[0]}}"+
				"<ul>{{tmpl(page.taxonConcepts) 'right.searchResultLink'}}</ul>"+
			"{{/if}}"+
		"</li>");
		
	jQuery.template("right.searchResultLink","<li><a>${nameAccordingTo}</a></li>");
	
	jQuery.template("right.options","<div class='panel' id='options'></div>");
	
	jQuery.template("right.help","<div class='panel' id='help'></div>");
	
	/******************
	 * Event handlers *
	 ******************/
	//tab click handler - changes displayed panel
	jQuery("#right .tab").live("click", function tabClick() {
		jQuery("#right .tab").removeClass("selected");
		jQuery(this).addClass("selected");
		jQuery("#right div.panel").hide().filter(this.hash).show();
		return false;
	});

	//holding F prevents selection update
	jQuery(document).keydown(function (eventObject) {
		if (eventObject.keyCode === 70) {
			selectionFrozen = true;
		}
	});

	jQuery(document).keyup(function (eventObject) {
		if (eventObject.keyCode === 70) {
			selectionFrozen = false;
		}
	});

	//node hover handler - updates details and statistics panels
	//TODO refactor this into a custom selection event handler, so it could be used by other kinds of views
	jQuery(".selectable").live("mousemove", function nodeMouseMove(event) {
		if (!selectionFrozen && this !== selectedElement ) {
			var tmplItem = jQuery(this).tmplItem(), //the template item for the hovered node
				statistics;

			selectedElement = this;
			jQuery(".selectable").removeClass("selected selected-path").filter(this).addClass("selected selected-path");
			jQuery(this).parents("div.node").addClass("selected-path");

			//update statistics panel
			statistics = jQuery.tmpl("right.statistics", tmplItem.data);
			jQuery("#statistics").empty().append(statistics.contents());
				
			//put a 'loading' image in the details panel in case we have to wait for the api
			image = jQuery("<img src='images/ajax-loader.gif'>");
			jQuery("#detail").empty().append(image);

			tmplItem.getEOLPage().done(function (page) {
					var details = jQuery.tmpl("right.detail", page, tmplItem.helper);
					jQuery("#detail").empty().append(details.contents());
			});
		}
		
		return false;
	});
		
	jQuery("body, div.root").live("mouseleave", function rootMouseLeave(event) {
		if (!selectionFrozen) {
			selectedElement = {};
			jQuery(".selectable").removeClass("selected selected-path");
		};

		return false;
	});
	
	jQuery("#search form").live('submit', function () {
		var query = jQuery("#search input").val(),
			rootClassificationName;
		
		if (!vole.getDisplayRootData().nameAccordingTo[0]) {
			//not looking at EOL tree.  TODO disable/hide search panel when this is true.
			return;
		}
		
		rootClassificationName = vole.getDisplayRootData().nameAccordingTo[0];

		//put a 'loading' image in the details panel while we have to wait for the api
		image = jQuery("<img src='images/ajax-loader.gif'>").height(15);
		jQuery("#search form input").after(image);
		
		api.searchPages(query, {page:1}, function (response) {
			var results = jQuery.tmpl("right.search", response);
			
			//decorate the same-classification results a bit
			results.find("li.result a").each(function () {
				var taxonConcept = jQuery(this).tmplItem().data,
					anchor = jQuery(this);

				if (taxonConcept.nameAccordingTo === rootClassificationName) {
					anchor.addClass('same-classification');
				}

				anchor.click(function() {
					vole.view(taxonConcept.identifier);
					return false;
				});
			});

			results.find(".result-page").before("<p>Results in the current EOL provider hierarchy are displayed <a class='same-classification'>like this</a>.</p>");
			
			jQuery("#search").empty().append(results.contents());
		});
	});
})();

