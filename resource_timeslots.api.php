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
