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
        public function __construct()
        {
            // Plugin timing
            add_action("activated_plugin", [$this, "load_plugin_last"]);

            // Requests
            add_action('init', [$this, 'pages_request']);
            add_action('template_redirect', [$this, 'catch_template_redirect'], 99999);

            // Admin panel
            add_action('admin_menu', [$this, 'create_plugin_settings_page']);
            add_action('admin_init', [$this, 'setup_sections']);
            add_action('admin_init', [$this, 'setup_fields']);

            // HTML modification
            add_action('wp_footer', [$this, 'inject_load_css_javascript']);
            add_action('wp_head', [$this, 'inject_critical_css']);
        }

        // ----------------------------------------------------------------------------------
        // PLUGIN TIMING FUNCTIONS
        // ----------------------------------------------------------------------------------

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
            if (isset($_REQUEST['focusr']) && $_REQUEST['focusr'] === "links") {
                echo $this->get_random_links();
                die();
            }
            else if (isset($_REQUEST['focusr']) && $_REQUEST['focusr'] === "disable") {
                $this->remove_actions();
            }
        }

        public function get_random_links()
        {
            global $wp_query;
            $links = new stdClass();
            $links->homepage = get_option('siteurl');

            // Get random post
            $args = ['post_type' => 'post', 'numberposts' => 1, 'order' => 'DESC', 'orderby' => 'rand'];
            query_posts($args);
            if (have_posts()) {
                while (have_posts()) {
                    the_post();
                    $links->single = get_permalink($wp_query->post->ID);
                    break;
                }
            }

            // Get random page
            $args = ['post_type' => 'page', 'numberposts' => 1, 'orderby' => 'rand'];
            query_posts($args);
            if (have_posts()) {
                while (have_posts()) {
                    the_post();
                    $links->page = get_permalink($wp_query->post->ID);
                    break;
                }
            }

            // Random category
            $taxonomy = 'category';
            $terms = get_terms($taxonomy);
            shuffle($terms);
            if ($terms) {
                foreach ($terms as $term) {
                    $links->category = get_category_link($term->term_id);
                    break;
                }
            }

            return json_encode($links);
        }

        public function remove_actions()
        {
            remove_action('wp_footer', [$this, 'inject_load_css_javascript']);
            remove_action('wp_head', [$this, 'inject_critical_css']);
            remove_action('template_redirect', [$this, 'catch_template_redirect'], 99999);
        }

        public function catch_template_redirect()
        {
            ob_start([$this, 'remove_link_tags']);
        }

        // ----------------------------------------------------------------------------------
        // ADMIN PANEL FUNCTIONS
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
                <h2>Focusr - Critical CSS Inliner</h2>
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
            add_settings_section('section_main', 'Settings', null, 'focusr_fields');
        }

        public function setup_fields()
        {
            $fields = [
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

            if ($arguments['helper']) {
                printf('<span class="helper"> %s</span>', $arguments['helper']);
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

            if ($arguments['supplemental']) {
                printf('<p class="description">%s</p>', $arguments['supplemental']);
            }
        }

        // ----------------------------------------------------------------------------------
        // HTML MODIFICATION FUNCTIONS
        // ----------------------------------------------------------------------------------

        public function inject_critical_css()
        {
            $outputDir = get_option('focusr_output_dir', 'focusr/wordpress/');

            $critical = "<style data-generated-by='focusr'>";
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
            }
            else {
                $critical .= "/*nofolder*/";
            }
            $critical .= "</style>";

            echo $critical;
        }

        public function inject_load_css_javascript()
        {
            $outputDir = get_option('focusr_output_dir', 'focusr/wordpress/');
            $loadCSS = "<script data-generated-by='focusr'>";
            if ($outputDir && $outputDir !== "") {
                if (!$this->endsWith($outputDir, "/")) {
                    $outputDir .= "/";
                }
                if (is_home()) {
                    $prefix = "homepage";
                }
                else if (is_single()) {
                    $prefix = "single";
                }
                else if (is_page()) {
                    $prefix = "page";
                }
                else if (is_category()) {
                    $prefix = "category";
                }
                else {
                    return;
                }

                $jsFilename = $this->get_base_path() . "/" . $outputDir . $prefix . ".js";
                try {
                    $handle = fopen($jsFilename, "r");
                    if ($handle) {
                        $loadCSS .= fread($handle, filesize($jsFilename));
                    }
                    else {
                        fclose($handle);
                        $loadCSS .= "/*Focusr: Can't load JS file*/";
                    }
                    fclose($handle);
                } catch (Exception $e) {
                    $loadCSS .= "/*Focusr: Can't load JS file*/";
                }
            }
            $loadCSS .= "</script>";

            echo $loadCSS;
        }

        public function remove_link_tags($buffer)
        {
            $re = "/<link .*rel=('|\")stylesheet\\1.*(\/>|<\/link>|>)/";
            $buffer = preg_replace($re, "", $buffer);

            return $buffer;
        }

        // ----------------------------------------------------------------------------------
        // HELPER FUNCTIONS
        // ----------------------------------------------------------------------------------

        public function get_base_path()
        {
            $base = dirname(__FILE__);
            $path = false;

            if (@file_exists(dirname(dirname($base)) . "/wp-config.php")) {
                $path = dirname(dirname($base));
            }
            else {
                if (@file_exists(dirname(dirname(dirname($base))) . "/wp-config.php")) {
                    $path = dirname(dirname(dirname($base)));
                }
                else {
                    $path = false;
                }
            }
            if ($path != false) {
                $path = str_replace("\\", "/", $path);
            }

            return $path;
        }

        public function endsWith($haystack, $needle)
        {
            return $needle === "" || (($temp = strlen($haystack) - strlen($needle)) >= 0 && strpos($haystack, $needle, $temp) !== false);
        }

    }

    new Focusr();
