var jQuery, EOLTreeMap;

jQuery(document).ready(function () {
	var w = jQuery("#content").width();
	var h = 800;

	jQuery("<div id='lightbox'></div>").width(w).height(h).appendTo("body");
	new EOLTreeMap(document.getElementById("lightbox"));
	jQuery('#lightbox').hide();
	
	jQuery("<a href='#lightbox'>TreeMap viewer</a>").appendTo("#textarea").openDOMWindow({ 
		eventType: 'click',
		width: w,
        height: h,
		windowPadding: 0
	}); 
});