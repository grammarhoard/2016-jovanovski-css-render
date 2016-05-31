# CSS Focusr
A critical path CSS extraction and injection tool using Node.js.

##Research questions:
- RQ1: Do requests to external CSS files make a significant negative impact on the time to first render?
- RQ2: What methods do existing tools use for detection, extraction and inlining of critical CSS rules?
- RQ3: How can critical CSS inlining be automated for dynamic web pages?

##What is CSS Focusr
CSS Focusr looks for critical "above the fold" CSS code. By defining a viewport, it renders the page and checks to see what 
elements are primarily visible in that area. It then extracts all CSS rules that apply to these "critical" elements, and embeds
them in a `<style>` tag at the very bottom of the `<head>` tag, moving the rest of the CSS to the bottom of the `<body>` tag.

This allows the browser to start rendering the page much faster, because CSS is a render-blocking resource, meaning, while the browser
is downloading all the CSS files defined in the head of the page, it will display a blank page, and only start rendering once it has them all
downloaded.
 
CSS Focusr helps solve this by inlining critical CSS in the head of the page (saving GET requests), and moving the rest
to the bottom of the body, where they have no more elements to block, and can be applied without stopping the render process.

###A more technical description
CSS Focusr looks for `<link rel='stylesheet'>` tags, extracts the CSS from the linked files,
looks for critical CSS by rendering the input HTML file, and checking if any element defined by the selectors in the parsed CSS
are positioned within the defined viewport. All critical CSS is then inlined as a `<style>` tag in the `<head>` tag, and the rest
are either inlined at the bottom of the `<body>` tag, or loaded from the existing `<link>` tags which have been moved to the bottom of
the `<body>` tag.

##Usage
Use the `config.json` to set options and processing groups
### Example
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
