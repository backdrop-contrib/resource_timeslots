# Resource Timeslots

Provides a field type to reserve timeslots for configurable resources and the
 widget type "Timeslot Fullcalendar" to conveniently select resource and time
 slot.

Provides Token and Views support for individual field subvalues.

Wraps [Fullcalendar 5.x](https://fullcalendar.io) as a reusable library.

![Widget screenshot](https://raw.githubusercontent.com/backdrop-contrib/resource_timeslots/1.x-1.x/screenshots/resource-timeslot-widget.png)

## Use cases

If you have resources that can only be used once at a time, like rooms, cars,
 machines, or whatever equipment, then Resource Timeslots can help to collect
 reservations in a simple and user friendly way.

## Installation

Install this module using the official Backdrop CMS
 [instructions](https://docs.backdropcms.org/documentation/extend-with-modules)

## Setup

You need two content types (node types), one acts as resource the other one acts
 as reservation.

The reservation type gets a "Resource timeslot" field attached, in which you
 set the "Resource content type" to your resource type.

Limit the number of slots people may add per node and field with the field's
 cardinality setting (Global settings -> Number of values).

If you want to preselect resources via links for new reservations, add a
 `resource-id=7` parameter to the url (href), where `7` is the node ID of the
 resource node.

If you want to show special messages after submission, or send mails, use
 the [Rules](https://backdropcms.org/project/rules) module.

## Issues

Bugs and Feature requests should be reported in the [Issue Queue](https://github.com/backdrop-contrib/resource_timeslots/issues)

## Known issues

- Does not work with node translations (multilingual resource nodes).
- The widget's slot delete button does not work on touch devices under certain
 circumstances.

## Current maintainers

* Indigoxela (https://github.com/indigoxela)

## Credits

Utilizes the MIT licensed [Fullcalendar library](https://github.com/fullcalendar/fullcalendar) to input time slots.

## License

This project is GPL v2 software. See the LICENSE.txt file in this directory for complete text.
