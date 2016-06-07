# CSS Focusr
A critical path CSS extraction and injection tool using Node.js.

##What is CSS Focusr
CSS Focusr looks for critical "above the fold" CSS rules. By giving it a viewport size, it renders your page and checks to see what 
elements are primarily visible in that viewport. It then extracts all CSS rules that apply to these "critical" elements, and embeds
them in a `<style>` tag in the `<head>` tag, loading the rest of the CSS from the bottom of the `<body>` tag with Javascript.

This allows the browser to start rendering the page much faster, because CSS is a render-blocking resource, meaning, while the browser
is downloading all the CSS files defined in the head of the page, it will display a blank page, and only start rendering once it has them all
downloaded.
 
CSS Focusr helps solve this by inlining critical CSS in the head of the page (saving GET requests), and moving the rest
to the bottom of the body, where they have no more elements to block, and can be applied without stopping the render process.

###A more technical description
CSS Focusr looks for `<link rel='stylesheet'>` tags, extracts the CSS from the linked files,
looks for critical CSS by rendering the input HTML file/URL, and checking if any element defined by the selectors in the parsed CSS
are positioned within the defined viewport. All critical CSS is then inlined as a `<style>` tag in the `<head>` tag, and the rest
is added into a Javascript function at the end of the `<body>` tag that uses the browser animation queue to load them in asynchronously.

##Usage
Each HTML file/URL that needs to be processed should be defined in its own group. Do this via `config.json` file, where you also override the default options of the tool.
### Example
This is the full default configuration file, with all possible settings that can be overridden.
```
{
  "debug": false,
  "allowJs": false,
  "processExternalCss" : true,
  "inlineNonCritical": false,
  "groups":[
    {
      "enabled": true,
      "baseDir": "tests/test3/",
      "inputFile" : "pre.html",
      "outputFile": "index.html",
      "alwaysInclude": [
        "lazyLoaded"
      ],
      "viewport" : [1200, 900]
    },
    {
      "enabled": false,
      "baseDir": "tests/test5/",
      "inputFile" : "http://thenextweb.com/facebook/2016/04/17/facebook-activates-safety-check-wake-earthquake-ecuador/",
      "outputFile": "critical.css",
      "viewport" : [1200, 900]
    },
    {
      "enabled": true,
      "wordpress": true,
      "baseDir": "../wordpress/focusr/wordpress/",
      "inputFile" : "http://thenextweb.com/",
      "alwaysInclude": [
        "lazyLoaded"
      ],
      "viewport" : [1200, 900]
    }
  ]
}
```

### debug
Works only on local input files (duh).

Add a red-bordered div as a first element in the `<body>` tag on the generated HTML to show the area covered by the critical CSS viewport.
### allowJs
Allow Javascript scripts to be executed that are included in the page before looking for critical CSS.

**WARNING** - Processing will take much longer as Javascript is not fast.
### processExternalCss
Allow extraction of critical CSS from external CSS files in `<link>` tags
### inlineNonCritical
If set to true, will make a new `<style>` tag at the end of the `<body>` and paste in all noncritical CSS.

If set to false, will copy and paste all `<link rel='stylesheet'>` tags at the end of the `body`
