var jQuery, EOLTreeMap;

jQuery(document).ready(function () {
	//This should all be changes that would be made to the html to accomodate the new visualization
	
	jQuery("#browser-text").after("<div id='lightbox'></div>");
	
	new EOLTreeMap(jQuery("#lightbox"));
	
	jQuery("#textarea > a").after("<a id='jitlink' href='#lightbox'>JIT</a>");
	jQuery("#jitlink").openDOMWindow({ 
		eventType: 'click',
		width: 800,
        height: 600,
		windowPadding: 0
	}); 
	jQuery('#lightbox').hide();
	
});