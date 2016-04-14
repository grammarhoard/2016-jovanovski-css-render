# CSS Focusr
A critical path CSS extraction and injection tool

## Todo:
- ~~Automatically detect and extract CSS from HTML files~~
- Remove critical rules from CSS Ast and convert it back to a string
- Test whether `<link>` in body, `<script async>` or other variants are faster 
- Deal with crap like `a[href^="javascript:"]:after`
- Remove overridden properties in generated CSS
- Remove multiple calls to PhantomJS