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
### Default config
This is the full default configuration file, with all possible settings that can be overridden.
```
{
    "allowJS": false,
    "debug": false,
    "processExternalCss": true,
    "renderTimeout": 60000,
    "groups": [
        {
        "enabled": true,
        "baseDir": "tests/",
        "inputFile": "",
        "outputFile": "",
        "alwaysInclude": [],
        "httpAuth": "",
        "wordpress": false,
        "viewport": [1200, 900],
        "outputJS": false
        }
    ]
}
```
### Example
An example configuration could look something like this
```
{
    "debug": true,
    "renderTimeout": 120000,
    "groups": [
        {
        "enabled": true,
        "baseDir": "tests/test1/",
        "inputFile": "pre.html",
        "outputFile": "index.html",
        "alwaysInclude": [
            '.div-important', '#main-title a'
        ],
        "viewport": [1280, 768]
        }
    ]
}
```

### Global settings
#### allowJs (boolean)
If set to true, will keep all `<script>` tags while processing the site with PhantomJS. WARNING: Allowing JS will slow the extraction process drastically.
#### debug (boolean)
If set to true, will add a red border to indicate the viewport area that is being examined on the resulting HTML file. Only works on local input files.
#### processExternalCss (boolean)
If set to false, will disable processing of externally linked CSS files.
#### renderTimeout (int)
Sets the time allowed for PhantomJS to render the site and find the critical CSS styles.

### Group settings
#### enabled (boolean)
Toggles if the group should be processed by Focusr.
#### baseDir (string)
The base directory to which the output (and possibly input) files are relative to.
#### inputFile (string)
A URL or path to a HTML file that should be processed, relative to the baseDir setting.
#### outputFile (string)
The path to the output file relative to the baseDir setting. If the inputFile is a URL, this will be the output for the critical CSS file. If the input file is an local HTML file, this will output the same HTML file with inlined critical CSS and JS.
#### alwaysInclude (array(string))
An array of selectors that should always be included as critical, regardless if they are in the initial viewport or not.
#### httpAuth (string)
A string of basic HTTP authentication, if needed for input files that are URLs. Format 'user:password'.
#### wordpress (boolean)
A boolean that states if the inputFile is a link to a Wordpress site that has the Focusr plugin installed.
#### viewport([int, int])
An array of 2 integers that state the width and height of the viewport.
#### outputJS (string)
If a path relative to the baseDir is entered here, the loadCSS Javascript will be saved to it.