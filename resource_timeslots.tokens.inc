<?php
/**
 * @file
 * Token module integration.
 */

/**
 * Implements hook_token_info().
 */
function resource_timeslots_token_info() {
  $type = array(
    'name' => t('Resource timeslots'),
    'description' => t('Tokens related to resource timeslot values.'),
    'needs-data' => 'resource-timeslot',
    'field' => TRUE,
  );

  $info['start-raw'] = array(
    'name' => t('Start raw'),
    'description' => t('The start date of the time slot as Unix timestamp.'),
  );
  $info['start-short'] = array(
    'name' => t('Start short'),
    'description' => t('The start date of the time slot formatted as short date.'),
  );
  $info['end-raw'] = array(
    'name' => t('End'),
    'description' => t('The end date of the time slot as Unix timestamp.'),
  );
  $info['end-short'] = array(
    'name' => t('End'),
    'description' => t('The end date of the time slot formatted as short date.'),
  );
  $info['resource-id'] = array(
    'name' => t('Resource ID'),
    'description' => t('Node ID of the related resource node.'),
  );
  $info['resource-title'] = array(
    'name' => t('Resource ID'),
    'description' => t('Title of the related resource node.'),
  );

  return array(
    'types' => array('resource-timeslot' => $type),
    'tokens' => array('resource-timeslot' => $info),
  );
}

/**
 * Implements hook_token_info_alter().
 */
function resource_timeslots_token_info_alter(&$data) {
  // Loop over every resource_timeslots field on the site.
  foreach (_resource_timeslots_get_timeslot_fields() as $field_name => $field) {
    foreach ($data['tokens'] as $group => $token) {
      if (isset($data['tokens'][$group][$field_name]) && is_array($data['tokens'][$group][$field_name])) {
        // Set the token type for the field.
        $data['tokens'][$group][$field_name]['type'] = 'resource-timeslot';
      }
    }
  }
}

/**
 * Helper function to return all node fields of type "resource_timeslots".
 */
function _resource_timeslots_get_timeslot_fields() {
  $node_fields = field_info_instances('node');
  $rs_fields = array();

  foreach ($node_fields as $type => $attached) {
    foreach ($attached as $field_name => $field) {
      if ($field['widget']['module'] == 'resource_timeslots') {
        $rs_fields[$field_name] = $field;
      }
    }
  }
  return $rs_fields;
}

/**
 * Implements hook_tokens().
 */
function resource_timeslots_tokens($type, $tokens, array $data = array(), array $options = array()) {
  $replacements = array();
  $langcode = LANGUAGE_NONE;

  if ($type == 'resource-timeslot' && !empty($data['resource-timeslot'][$langcode]) && is_array($data['resource-timeslot'][$langcode])) {
    // Get the first field item.
    $values = reset($data['resource-timeslot'][$langcode]);

    foreach ($tokens as $name => $original) {
      switch ($name) {
        case 'start-raw':
          $replacements[$original] = $values['start'];
          break;

        case 'start-short':
          $replacements[$original] = format_date($values['start'], 'short');
          break;

        case 'end-raw':
          $replacements[$original] = $values['end'];
          break;

        case 'end-short':
          $replacements[$original] = format_date($values['end'], 'short');
          break;

        case 'resource-id':
          $replacements[$original] = $values['resource_id'];
          break;

        case 'resource-title':
          $node = node_load($values['resource_id']);
          if ($node) {
            // No check_plain needed here as "sanitize" is on by default in
            // token_generate().
            $replacements[$original] = $node->title;
          }
          break;

      }
    }
  }
  // Dynamically generate token replacements as needed.
  if ($type == 'node') {
    foreach (_resource_timeslots_get_timeslot_fields('node') as $field_name => $field) {
      if ($rt_tokens = token_find_with_prefix($tokens, $field_name)) {
        if (property_exists($data['node'], $field_name)) {
          $replacements += token_generate('resource-timeslot', $rt_tokens, array(
            'resource-timeslot' => $data['node']->$field_name,
          ), $options);
        }
      }
    }
  }

  return $replacements;
}
