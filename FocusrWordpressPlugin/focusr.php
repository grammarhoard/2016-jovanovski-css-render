<?php

    /*
    Plugin Name: Focusr
    Plugin URI: http://gorjan.rocks
    Description: A plugin to enable Focusr critical CSS to be embedded
    Version: 0.1
    Author: Gorjan Jovanovski
    Author URI: http://gorjan.rocks
    License: GPL2
    */

    class Focusr
    {
        private $ignore = false;

        public function __construct()
        {
            add_action("activated_plugin", [$this, "load_plugin_last"]);
            add_action('admin_menu', [$this, 'create_plugin_settings_page']);
            add_action('admin_init', [$this, 'setup_sections']);
            add_action('admin_init', [$this, 'setup_fields']);
            add_action('init', [$this, 'pages_request']);
            //add_action('wp_head', [$this, 'hook_css']);
            add_action('template_redirect', [$this, 'catch_template_redirect'], 99999);
        }

        public function load_plugin_last()
        {
            $wp_path_to_this_file = preg_replace('/(.*)plugins\/(.*)$/', WP_PLUGIN_DIR . "/$2", __FILE__);
            $this_plugin = plugin_basename(trim($wp_path_to_this_file));
            $active_plugins = get_option('active_plugins');
            $this_plugin_key = array_search($this_plugin, $active_plugins);
            if ($this_plugin_key < count($active_plugins) - 1) {
                array_splice($active_plugins, $this_plugin_key, 1);
                array_push($active_plugins, $this_plugin);
                update_option('active_plugins', $active_plugins);
            }
        }

        // ----------------------------------------------------------------------------------
        // REQUEST FUNCTIONS
        // ----------------------------------------------------------------------------------

        public function pages_request()
        {
            if (isset($_REQUEST['focusr']) && $_REQUEST['focusr'] == "yes") {
                global $wp_query;
                $paths = new stdClass();
                $paths->homepage = get_option('siteurl');

                // Get random post
                $args = ['post_type' => 'post', 'numberposts' => 1, 'order' => 'DESC', 'orderby' => 'rand'];
                query_posts($args);
                if (have_posts()) {
                    while (have_posts()) {
                        the_post();
                        $paths->single = get_permalink($wp_query->post->ID);
                        break;
                    }
                }

                // Get random page
                $args = ['post_type' => 'page', 'numberposts' => 1, 'orderby' => 'rand'];
                query_posts($args);
                if (have_posts()) {
                    while (have_posts()) {
                        the_post();
                        $paths->page = get_permalink($wp_query->post->ID);
                        break;
                    }
                }

                // Random category
                $taxonomy = 'category';
                $terms = get_terms($taxonomy);
                shuffle($terms);
                if ($terms) {
                    foreach ($terms as $term) {
                        $paths->category = get_category_link($term->term_id);
                        break;
                    }
                }
                echo json_encode($paths);
                die();
            }
            else if (isset($_REQUEST['focusr']) && $_REQUEST['focusr'] == "no") {
                $this->ignore = true;
            }
        }

        // ----------------------------------------------------------------------------------
        // SETTINGS FUNCTIONS
        // ----------------------------------------------------------------------------------

        public function create_plugin_settings_page()
        {
            $page_title = 'Focusr Settings';
            $menu_title = 'Focusr';
            $capability = 'manage_options';
            $slug = 'smashing_fields';
            $callback = [$this, 'plugin_settings_page_content'];
            $icon = 'dashicons-admin-customizer';
            $position = 100;

            add_menu_page($page_title, $menu_title, $capability, $slug, $callback, $icon, $position);
        }

        public function plugin_settings_page_content()
        { ?>
            <div class="wrap">
                <h2>Focusr Settings</h2>
                <form method="post" action="options.php">
                    <?php
                        settings_fields('focusr_fields');
                        do_settings_sections('focusr_fields');
                        submit_button();
                    ?>
                </form>
            </div> <?php
        }

        public function setup_sections()
        {
            add_settings_section('section_main', 'Main settings', [$this, 'section_callback'], 'focusr_fields');
        }

        public function section_callback($arguments)
        {
            switch ($arguments['id']) {
                case 'section_main':
                    echo 'We need some paths here in order to find generated critical CSS';
                    break;
            }
        }

        public function setup_fields()
        {
            $fields = [
//                [
//                    'uid'     => 'focusr_enabled',
//                    'label'   => 'Enabled',
//                    'section' => 'section_main',
//                    'type'    => 'checkbox',
//                    'options' => false,
//                    'default' => 'checked'
//                ],
                [
                    'uid'          => 'focusr_output_dir',
                    'label'        => 'CSS directory',
                    'section'      => 'section_main',
                    'type'         => 'text',
                    'options'      => false,
                    'placeholder'  => 'focusr/wordpress/',
                    'helper'       => $this->get_base_path() . "/",
                    'supplemental' => 'Path to the output directory of Focusr relative to the root of the Wordpress installation',
                    'default'      => 'focusr/wordpress/'
                ]
            ];
            foreach ($fields as $field) {
                add_settings_field($field['uid'], $field['label'], [$this, 'field_callback'], 'focusr_fields', $field['section'], $field);
                register_setting('focusr_fields', $field['uid']);
            }
        }

        public function field_callback($arguments)
        {
            $value = get_option($arguments['uid']);
            if (!$value) {
                $value = $arguments['default'];
            }

            if ($helper = $arguments['helper']) {
                printf('<span class="helper"> %s</span>', $helper); // Show it
            }

            switch ($arguments['type']) {
                case 'text':
                    printf('<input name="%1$s" id="%1$s" type="%2$s" placeholder="%3$s" value="%4$s" />', $arguments['uid'], $arguments['type'], $arguments['placeholder'], $value);
                    break;
                case 'textarea':
                    printf('<textarea name="%1$s" id="%1$s" placeholder="%2$s" rows="5" cols="50">%3$s</textarea>', $arguments['uid'], $arguments['placeholder'], $value);
                    break;
                case 'checkbox':
                    printf('<input name="%1$s" id="%1$s" type="%2$s" %3$s/>', $arguments['uid'], $arguments['type'], $value);
                    break;
                case 'select':
                    if (!empty ($arguments['options']) && is_array($arguments['options'])) {
                        $options_markup = '';
                        foreach ($arguments['options'] as $key => $label) {
                            $options_markup .= sprintf('<option value="%s" %s>%s</option>', $key, selected($value, $key, false), $label);
                        }
                        printf('<select name="%1$s" id="%1$s">%2$s</select>', $arguments['uid'], $options_markup);
                    }
                    break;
            }

            if ($supplimental = $arguments['supplemental']) {
                printf('<p class="description">%s</p>', $supplimental); // Show it
            }
        }

        // ----------------------------------------------------------------------------------
        // CSS FUNCTIONS
        // ----------------------------------------------------------------------------------

        public function process_page($buffer)
        {

            if ($this->ignore) {
                return $buffer;
            }

//            require_once(plugin_dir_path(__FILE__) . 'lib/simple_html_dom.php');
//            $html = new simple_html_dom();
//            $dom = $html->load($buffer);
//            $links = [];
//            $linkNodes = $dom->find('link[rel="stylesheet"]');
//            foreach ($linkNodes as $node) {
//                $links[] = $node->href;
//                $node->outertext = "";
//            }
//
//            $loadCSSJS = "<script>var cb = function () { var s = ['" . implode("','", $links) . "'];for(var i=0;i< s.length;i++){var l = document.createElement('link');l.rel = 'stylesheet';l.href = s[i];var h = document.getElementsByTagName('head')[0];h.parentNode.insertBefore(l, h);}};var raf = requestAnimationFrame || mozRequestAnimationFrame || webkitRequestAnimationFrame || msRequestAnimationFrame;if (raf) raf(cb); else window.addEventListener('load', cb);</script>";
//            $body = $dom->find("body")[0];
//            $body->outertext = "<body>" . $body->innertext . $loadCSSJS . '</body>';
//
//            $dom->save();
//
//            $buffer = $dom;

//            -----------------------------------


            $dom = new DOMDocument;
            $dom->loadHTML(mb_convert_encoding($buffer, 'HTML-ENTITIES', "UTF-8"));
            $body = $dom->getElementsByTagName('body')[0];
            $head = $dom->getElementsByTagName('head')[0];
            $linkTags = iterator_to_array($dom->getElementsByTagName('link'));
            $srcLinks = [];

            //remove links
            foreach ($linkTags as $link) {
                $attribute = $link->getAttribute("rel");
                if (isset($attribute) && !is_null($attribute) && $attribute == "stylesheet") {
                    $link->parentNode->removeChild($link);
                    $srcLinks[] = $link->getAttribute("href");
                }
            }

            //load files
            $outputDir = get_option('focusr_output_dir', 'focusr/wordpress/');

            $critical = "<style data-generated-by='focusr'>";
            $loadCSS = "<script data-generated-by='focusr'>";
            if ($outputDir && $outputDir !== "") {
                if (!$this->endsWith($outputDir, "/")) {
                    $outputDir .= "/";
                }
                $prefix = "homepage";

                if (is_single()) {
                    $prefix = "single";
                }
                else if (is_page()) {
                    $prefix = "page";
                }
                else if (is_category()) {
                    $prefix = "category";
                }

                $cssFilename = $this->get_base_path() . "/" . $outputDir . $prefix . ".css";
                try {
                    $handle = fopen($cssFilename, "r");
                    if ($handle) {
                        $critical .= fread($handle, filesize($cssFilename));
                    }
                    else {
                        fclose($handle);
                        $critical .= "/*exc*/";
                    }
                    fclose($handle);
                } catch (Exception $e) {
                    $critical .= "/*exc2*/";
                }

                $jsFilename = $this->get_base_path() . "/" . $outputDir . $prefix . ".js";
                try {
                    $handle = fopen($jsFilename, "r");
                    if ($handle) {
                        $loadCSS .= fread($handle, filesize($jsFilename));
                    }
                    else {
                        fclose($handle);
                        $loadCSS .= "/*exc*/";
                    }
                    fclose($handle);
                } catch (Exception $e) {
                    $loadCSS .= "/*exc2*/";
                }
            }
            else{
                $critical .= "/*nofolder*/";
            }
            $critical .= "</style>";
            $loadCSS .= "</script>";

            $this->prependHTML($head, $critical);
            $this->appendHTML($body, $loadCSS);

            $buffer = $dom->saveHTML();

            return mb_convert_encoding($buffer, "UTF-8", 'HTML-ENTITIES');
        }

        public function appendHTML(DOMNode $parent, $source)
        {
            $tmpDoc = new DOMDocument();
            $tmpDoc->loadHTML($source);
            foreach ($tmpDoc->getElementsByTagName('head')->item(0)->childNodes as $node) {
                $node = $parent->ownerDocument->importNode($node, true);
                $parent->appendChild($node);
            }
        }

        public function prependHTML(DOMNode $parent, $source)
        {
            $tmpDoc = new DOMDocument();
            $tmpDoc->loadHTML($source);
            foreach ($tmpDoc->getElementsByTagName('head')->item(0)->childNodes as $node) {
                $node = $parent->ownerDocument->importNode($node, true);
                $parent->insertBefore($node, $parent->childNodes->item(0));
            }
        }

        public function catch_template_redirect()
        {
            ob_start();
            ob_start([$this, 'process_page']);
        }

        public function endsWith($haystack, $needle)
        {
            return $needle === "" || (($temp = strlen($haystack) - strlen($needle)) >= 0 && strpos($haystack, $needle, $temp) !== false);
        }

        public function get_base_path()
        {
            $base = dirname(__FILE__);
            $path = false;

            if (@file_exists(dirname(dirname($base)) . "/wp-config.php")) {
                $path = dirname(dirname($base));
            }
            else
                if (@file_exists(dirname(dirname(dirname($base))) . "/wp-config.php")) {
                    $path = dirname(dirname(dirname($base)));
                }
                else
                    $path = false;

            if ($path != false) {
                $path = str_replace("\\", "/", $path);
            }

            return $path;
        }


    }

    new Focusr();
