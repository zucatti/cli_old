<span class="MONTHS"></span>
<script>

function loadResources(list,cb) {
	for (var i=0;i<list.length;i++) {
		var link = document.createElement('link');
		link.rel="stylesheet";
		link.type="text/css";
		link.href=list[i];
		document.getElementsByTagName('head')[0].appendChild(link);
	};
	cb();
};

require = function(url,cb) {
	
	var loadScript = function(url,callback) {
		
		var script = document.createElement("script");
		script.type = "text/javascript";
		if (script.readyState){  
			script.onreadystatechange = function(){
				if (script.readyState == "loaded" ||
						script.readyState == "complete"){
					script.onreadystatechange = null;
					callback();
				}
			};
		} else {  
			script.onload = callback;
		};
		script.src = url;
		document.getElementsByTagName("head")[0].appendChild(script);
	};

	function loadResources(url) {
		var link=document.createElement('link');
		link.rel="stylesheet";
		link.type="text/css";
		link.href=url;
		document.getElementsByTagName('head')[0].appendChild(link);
	};

	function loader(list,i,cbz) {

		if (!list[i]) return cbz();

		var url=list[i];
		if (url.indexOf('.css')>-1) {
			loadResources(url);
			return loader(list,i+1,cbz);
		};

		function reqListener () {
			if (!this.response) this.response="";
				window.eval(this.response);
				return loader(list,i+1,cbz);
		};

		function transferFailed() {
			throw "Script: "+list[i]+" Not found";
		};
		
		function updateProgress() {
			
		};
		
		function transferCanceled() {
			
		};
		
		
		if (url.substr(0,1)=="!") {
			loadScript(url.substr(1,url.length),function() {
				loader(list,i+1,cbz)	
			});
			return;
		};
		
		if (url.indexOf('.js')==-1) url=url+".js";

		var newXHR = new XMLHttpRequest();
		newXHR.addEventListener( 'load' , reqListener,false );
		newXHR.addEventListener( "progress" , updateProgress, false);
		newXHR.open( 'GET', url );
		newXHR.send();			
	};

	loader(url,0,cb);

};



function BOOTSTRAP_ME() {
	require(['Settings'],function() {
			require(Settings.MODULES,function() {
				require(['app'],function() {
					
				});
			});
	});
};



window.z="0mneediaRulez!";

setTimeout(BOOTSTRAP_ME,1000);


</script>