# CSS Focusr
A critical path CSS extraction and injection tool using Node.js

## Usage
Use the `config.json` to set options
```
    {
      "autoOpen": false,
      "debug": false,
      "allowJs": false,
      "processExternalCss" : true,
      "inlineNonCritical": false,
      "groups":[
        {
          "enabled": true,
          "baseDir": "tests/test1/",
          "inputFile" : "pre.html",
          "outputFile": "index.html",
          "viewport" : [375, 667]
        },
        {
          "enabled": false,
          "baseDir": "tests/test5/",
          "inputFile" : "http://gorjan.rocks",
          "outputFile": "critical.css",
          "viewport" : [1200, 900]
        }
        .
        .
        .
      ]
    }
```

### autoOpen
[Buggy] Auto open the generated files upon completion
### debug (requires local input file)
Add a red-bordered div around on the generated HTML to show the area covered by the critical CSS viewport
### allowJs
Allow JS to be executed before looking for critical CSS.
**WARNING** - processing will be very slow this way.
### processExternalCss
Allow extraction of critical css from external CSS files
### inlineNonCritical
If set to true, will make a new `<style>` tag at the end of the `body` and paste in all noncritical CSS.
If set to false, will copy and paste all `<link rel='stylesheet'>` tags at the end of the `body`


## Todo
- ~~[Feature] Allow loading of HTML file via URL (ex: for Wordpress)~~
- [Research] Test whether `<link>` or `<style>` in body, `<script async>` or other variants are faster 
    - Embedding in `<style>` is faster for time to first render, but we need to look at TCP/IP packet size vs. new requests
- [BugFix] Deal with crap like `a[href^="javascript:"]:after`
- [BugFix] Deal with crap like `@-ms-viewport`
- [BugFix] Find out why `open` does not work on any other test case than case 1
- [Optimize] Remove overridden properties in generated CSS (ex `width: 0` ... `width: 100%`)
- [Optimize] Remove multiple calls to PhantomJS
- ~~[BugFix] Take care of relative paths in CSS (ex `background-image` `font-face`)~~
- ~~[Feature] Create 2 AST's for critical and noncritical CSS~~
- ~~[Feature] Add media rules that don't apply to current viewport in the non-critical CSS~~
- ~~[Feature] Automatically detect and extract CSS file links from given HTML files~~
- ~~[Feature] Option to embed all noncritical in `<script>` tag or with original `<link>` tags~~