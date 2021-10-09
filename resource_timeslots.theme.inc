<?php
/**
 * @file
 * Theme functions.
 */

/**
 * Returns items as a one-liner.
 */
function theme_resource_timeslot_oneliner($variables) {
  $output = '';
  $item = $variables['item'];
  $start_date = format_date($item['start'], 'custom', 'Y-m-d');
  $end_date = format_date($item['end'], 'custom', 'Y-m-d');
  if ($start_date == $end_date) {
    // If start and end are on the same day, don't repeat the date.
    $format = system_get_date_formats('medium');
    $regex = '/[^aABgGhHis: ]/';
    $time_only = preg_replace($regex, '', $format['pattern']);

    $date_text = t('from @start to @end', array(
      '@start' => format_date($item['start']),
      '@end' => format_date($item['end'], 'custom', $time_only),
    ));
  }
  else {
    $date_text = t('from @start to @end', array(
      '@start' => format_date($item['start']),
      '@end' => format_date($item['end']),
    ));
  }
  $nid = $item['resource_id'];
  $node = node_load($item['resource_id']);
  if ($node) {
    $output .= '<span class="resource-title">' . check_plain($node->title) . '</span> ';
  }
  $output .= '<span class="timeslot">' . $date_text . '</span>';

  return $output;
}

/**
 * Returns items as an unordered list.
 */
function theme_resource_timeslot_list($variables) {
  $item = $variables['item'];

  $output = '<ul class="resource-timeslot-list">';

  $nid = $item['resource_id'];
  $node = node_load($item['resource_id']);
  if ($node) {
    $name = node_type_get_name($node);
    $output .= '<li class="resource"><span class="label">' . $name . '</span>: ' . check_plain($node->title) . '</li> ';
  }
  $output .= '<li><span class="label">' . t('Start') . '</span>: ' . format_date($item['start']) . '</li>';
  $output .= '<li><span class="label">' . t('End') . '</span>: ' . format_date($item['end']) . '</li>';

  $output .= '</ul>';

  return $output;
}

/**
 * Returns a table.
 */
function theme_resource_timeslot_table($variables) {
  $header = array(
    t('Resource'),
    t('From'),
    t('To'),
  );
  $rows = array();

  if (!empty($variables['items']) && isset($variables['items'][0]['resource_id'])) {
    $items = $variables['items'];
    $node = node_load($items[0]['resource_id']);
    $title = $node->title;
    foreach ($items as $item) {
      $rows[] = array(
        $title,
        format_date($item['start']),
        format_date($item['end']),
      );
    }
  }
  $data = array(
    'header' => $header,
    'rows' => $rows,
  );
  $output = theme('table', $data);

  return $output;
}
