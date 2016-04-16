# CSS Focusr
A critical path CSS extraction and injection tool using Node.js.

Given the files, it looks for `<link rel='stylesheet'>` tags, extracts the CSS from the linked files,
looks for critical CSS by rendering the input, and checking if any element defined by the selectors in the parsed CSS
is positions within the defined viewport. All critical CSS is then inlined as a `<style>` tag in the `<head>` tag, and the rest
is eiher inlined at the bottom of the `<body>` tag, or loaded from the existing `<link>` tags which have been moved to the bottom of
the `<body>` tag.

## Usage
Use the `config.json` to set options and processing groups
### Example
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
[Buggy] Auto open the generated files upon completion in your default program of choice.
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


## Todo
- [Research] Test whether `<link>` or `<style>` in body, `<script async>` or other variants are faster 
    - Embedding in `<style>` is faster for time to first render, but we need to look at TCP/IP packet size vs. new requests
- [BugFix] Deal with crap like `a[href^="javascript:"]:after`
- [BugFix] Deal with crap like `@-ms-viewport`
- [BugFix] Find out why `open` does not work on any other test case than case 1
- [Optimize] Remove overridden properties in generated CSS (ex `width: 0` ... `width: 100%`)
- [Optimize] Remove multiple calls to PhantomJS
- ~~[Feature] Allow loading of HTML file via URL (ex: for Wordpress)~~
- ~~[BugFix] Take care of relative paths in CSS (ex `background-image` `font-face`)~~
- ~~[Feature] Create 2 AST's for critical and noncritical CSS~~
- ~~[Feature] Add media rules that don't apply to current viewport in the non-critical CSS~~
- ~~[Feature] Automatically detect and extract CSS file links from given HTML files~~
- ~~[Feature] Option to embed all noncritical in `<script>` tag or with original `<link>` tags~~