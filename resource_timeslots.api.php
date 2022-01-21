<?php
/**
 * @file
 * API provided by the Resource Timeslots module.
 */

/**
 * Implements hook_form_FORM_ID_alter().
 *
 * Fullcalendar has loads of options. If you want to customize the calendar,
 * implement hook_form_alter() or hook_form_FORM_ID_alter() and add your
 * customization via a js setting like below.
 *
 * @see https://fullcalendar.io/docs
 */
function MYMODULE_form_FORM_ID_alter(&$form, &$form_state, $form_id) {
  $custom_settings = array(
    'timeZone' => 'UTC',
    'nowIndicator' => TRUE,
    'allDaySlot' => TRUE,
  );
  // Settings from "resource_timeslots_custom" will get applied in file
  // resource-ts.js in Backdrop.behaviors.resourceTimeslot.
  $form['#attached']['js'][] = array(
    'type' => 'setting',
    'data' => array(
      'resource_timeslots_custom' => $custom_settings,
    ),
  );
}

/**
 * Alter the list of available resources in the node form select list.
 *
 * The following example replaces the whole array with values from a custom
 * view, but you could also just filter out nodes by ID from the existing list.
 * For instance with an "unset($nodes[123])".
 *
 * @param array $nodes
 *   Array of node titles keyed by node id (nid).
 *
 * @code
 *   // Example:
 *   $nodes = array(
 *     23 => 'A node title',
 *     34 => 'Another title',
 *   );
 * @endcode
 *
 * @see _resource_timeslots_get_node_options()
 */
function HOOK_resource_timeslots_node_options_alter(&$nodes) {
  // Load a custom view and execute.
  $view = views_get_view('my_custom_view');
  if ($view) {
    $custom_options = array();
    $view->execute();
    $result = $view->result;
    foreach ($result as $object) {
      $custom_options[$object->nid] = $object->node_title;
    }
    $nodes = $custom_options;
  }
}
