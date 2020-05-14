<script>
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

	function loadResources(list,i,cbz) {
		if (!list[i]) return cbz();
		var link=document.createElement('link');
		link.rel="stylesheet";
		link.type="text/css";
		document.getElementsByTagName('')
	};

	function loader(list,i,cbz) {

		if (!list[i]) return cbz();

		var url=list[i];

		function reqListener () {
			if (!this.response) this.response="";
			if (list[i].indexOf('.modules.js')>-1) {
				var modules=eval(this.response);
				var zpath=list[i].substr(0,list[i].lastIndexOf('/')+1);
				list.splice(i,1);
				for (var j=modules.length-1;j>=0;j--) list.splice(i,0,zpath+modules[j]);
				return loader(list,i,cbz);
			} else {
				window.eval(this.response);
				return loader(list,i+1,cbz);
			}
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

function BOOTSTRAP_ME() {
	require(['Contents/Settings'],function() {
		loadResources(Settings.RESOURCES, function() {
			require(Settings.FRAMEWORKS,function() {

				require(['Contents/Application/app.js'],function() {
					
				});

			});
		});
	});
}

/*
if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js', {scope: '/'})
                    .then(function () {
                        console.log('Service Worker Registered');
                    });
                navigator.serviceWorker.ready.then(function () {
                    console.log('Service Worker Ready');
                });
            });
        }
*/

window.z="0mneediaRulez!";
setTimeout(BOOTSTRAP_ME,1000);


</script>