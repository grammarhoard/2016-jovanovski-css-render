var app=function(t,i){"use strict";return{config:{jsPath:"/assets/js"},init:function(){this.loadModules()},hasModule:function(t){return"object"==typeof this.resolveModule(t)},loadModule:function(i,n){var o,e;o=this.resolveModule(i),e=i.replace(/\./g,"/"),null===o?t.getScript(this.config.jsPath+"/"+e+".js").done(function(){this.resolveModule(i).init()}.bind(this)):o.init()},loadModules:function(){var i=t.trim(t("html").attr("data-modules"));""!==i&&i.split("|").forEach(function(t){this.loadModule(t,null)}.bind(this))},resolveModule:function(t){var i,n,o;for(n=t.split("."),i=n.shift(),o=this;i;){if(o.hasOwnProperty(i)&&(o=o[i],!n.length))return o;i=n.shift()}return null}}}($,Modernizr);$(function(){app.init()}),app.core=function(t,i,n){"use strict";return{init:function(){t(".js-pinterest").pinterest({accessToken:"AY04wIpX92EyEvll-xf2o0xiroOnFDTrgpX1KqdC4fk2ZmAr6wAAAAA",board:"uniformant/lacoste-polo"})}}}($,app,Modernizr),$(app.core.init);
//# sourceMappingURL=maps/bundle.js.map
