(function ($) {

  'use strict';

  var resourceTimeslotWidget = resourceTimeslotWidget || {};

  Backdrop.behaviors.resourceTimeslot = {
    attach: function (context, settings) {

      $('.dt-range-fullcal').each(function (i, item) {
        var calendarId = item.attributes.id.nodeValue;
        var calendarEl = document.getElementById(calendarId);

        var inputContainer = $(this).parent('.form-item').next('.fullcalendar-input');
        var existingStartTs = inputContainer.find('.fc-start').val();
        var dateInitial = null;
        var selectFormItem = $(this).parent('.form-item').prev('.form-type-select');
        var resourceId = selectFormItem.find('option:selected').val();
        var resourceTitle = selectFormItem.find('option:selected').text();
        var reserved = { id: 'reserved', events: [] };
        var fcData = $(this).parent('.form-item').next().next('.fc-data').val();// @todo one next has to go.
        var currentItems = JSON.parse(fcData);
        var fieldName = $(this).attr('data-fieldname');
        var widgetSettings = settings.resource_timeslots_setup[fieldName];
        var maxValues = Number(widgetSettings.maxValues);
        var validRange = widgetSettings.validRange;
        if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
          reserved.events = widgetSettings.reserved[resourceId];
        }
        var dateOnly = false;
        if (widgetSettings.calendarType === 'dayGridMonth') {
          dateOnly = true;
        }

        var options = {
          timeZone: widgetSettings.timezone,
          firstDay: widgetSettings.firstDay,
          locale: widgetSettings.langCode,
          headerToolbar: {
            left: 'prev',
            center: 'title',
            right: 'next'
          },
          longPressDelay: 800,
          initialView: widgetSettings.calendarType,
          height: 'auto',
          allDaySlot: false,
          eventSources: [ reserved ],
          eventOverlap: false,
          selectOverlap: false,
          editable: true,
          selectable: true,
          validRange: validRange,
          initialDate: dateInitial,
          slotDuration: widgetSettings.minSlotSize,
          select: function(info) {
            calendar.addEvent({
              title: resourceTitle,
              start: info.startStr,
              end: info.endStr,
              classNames: ['current-items']
            });
            let count = resourceTimeslotWidget.updateFieldValue(calendarId, calendar.getEvents(), dateOnly);
            // Consider field cardinality.
            if (count >= maxValues) {
              calendar.setOption('selectable', false);
            }
          },
          eventResize: function(info) {
            var range = info.event._instance.range;
            resourceTimeslotWidget.updateFieldValue(calendarId, range.start, range.end, dateOnly);
          },
          eventDrop: function(info) {
            var range = info.event._instance.range;
            resourceTimeslotWidget.updateFieldValue(calendarId, range.start, range.end, dateOnly);
          },
          eventContent: function(arg) {
            if (arg.event._def.ui.display === 'background') {
              return '';
            }
            // Improvised close button.
            var markup = '<div class="remove-btn">Remove</div><div class="event-title">' + resourceTitle + '</div>';
            markup += '<div class="event-text">' + arg.timeText + '</div>';
            return { html: markup };
          },
          eventClick: function(info) {
            if (info.jsEvent.srcElement.className === 'remove-btn') {
              info.event.remove();
              resourceTimeslotWidget.resetFieldValue(calendarId);
              calendar.setOption('selectable', true);// @todo cardinality
            }
          }
        };

        if (widgetSettings.businessHours !== null) {
          options.businessHours = widgetSettings.businessHours;
          options.eventConstraint = widgetSettings.businessHours;
          options.selectConstraint = widgetSettings.businessHours;
          options.slotMinTime = widgetSettings.businessHours.startTime;
          options.slotMaxTime = widgetSettings.businessHours.endTime;
        }

        // Let modules or themes override options by adding a js setting
        // 'resource_timeslots_custom' to the page.
        $.extend(options, settings.resource_timeslots_custom);

        var calendar = new FullCalendar.Calendar(calendarEl, options);

        if (widgetSettings.calendarType == 'timeGridWeek') {
          calendar.setOption('firstDay', new Date(validRange.start).getDay());
        }

        if (currentItems.length) {
          for (let i = 0; i < currentItems.length; i++) {
            var slot = {
              start: new Date(currentItems[i].start),
              end: new Date(currentItems[i].end),
              classNames: ['current-items']
            }
            currentItems[i] = slot;
            calendar.addEvent(slot);
          }
          if (currentItems.length >= maxValues) {
            calendar.setOption('selectable', false);
          }
          // Make sure existing items are always accessible, even if in the past.
          var rangeStart = new Date(options.validRange.start);
          if (rangeStart.getTime() > currentItems[0].start.getTime()) {
            var pastRange = {
              start: currentItems[0].start.toUTCString(),
              end: widgetSettings.validRange.end
            };
            calendar.setOption('validRange', pastRange);
          }
          // Go to the first existing slot.
          calendar.gotoDate(slot.start);
        }
        calendar.render();

        // Maybe a race condition, but the feed doesn't initially work if the
        // resource ID got set via GET param. So we fetch after render, which
        // seems to work.
        var feed = {
          id: 'feed',
          url: null
        };
        if (widgetSettings.feedUrl !== null) {
          if (resourceId > 0) {
            feed.url = widgetSettings.feedUrl.replace('{ID}', resourceId);
            calendar.addEventSource(feed);
          }
        }

        selectFormItem.find('select').change(function () {
          resourceId = $(this).find('option:selected').val();
          resourceTitle = $(this).find('option:selected').text();
          reserved.events = [];
          if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
            reserved.events = widgetSettings.reserved[resourceId];
          }
          // When switching resources, reserved values are different. Remove the
          // old EventSource objects and add the current ones.
          var current = calendar.getEventById('current-item');
          if (current !== null) {
            current.remove();
            calendar.setOption('selectable', true);
          }
          if (widgetSettings.feedUrl !== null) {
            if (resourceId > 0) {
              feed.url = widgetSettings.feedUrl.replace('{ID}', resourceId);
              let eventSourceFeed = calendar.getEventSourceById('feed');
              if (eventSourceFeed !== null) {
                eventSourceFeed.remove();
              }
              calendar.addEventSource(feed);
            }
          }
          let eventSourceLocal = calendar.getEventSourceById('reserved');
          if (eventSourceLocal !== null) {
            // Can this ever be null?
            eventSourceLocal.remove();
          }
          calendar.addEventSource(reserved);
        });

      });
    }
  };

  /**
   * Utility functions.
   */

  /**
   * @param string selector
   *   HTML ID of the current calendar container.
   * @param array values
   *   Array of all Fullcalendar event objects, including background events.
   * @param bool dateonly
   *   Whether date or date and time should be displayed.
   *
   * @return int
   *   Number of current events.
   */
  resourceTimeslotWidget.updateFieldValue = function (selector, values, dateonly) {
    // Warning: start/end objects get the wrong UTC offset (Fullcalendar), so we
    // have to calculate from local offset to end up with the right timezone.
    // Special care with Safari!
    // Function getTimezoneOffset() returns minutes, we need msec.
    var result = [];
    for (let i = 0; i < values.length; i++) {
      // Filter out the current (dynamic) items.
      if (values[i].classNames.indexOf('current-items') > -1) {
        var startUTC = new Date(values[i].start.getTime() + (values[i].start.getTimezoneOffset() * 60 * 1000));
        var endUTC = new Date(values[i].end.getTime() + (values[i].end.getTimezoneOffset() * 60 * 1000));
        result.push({
          start: startUTC,
          end: endUTC
        });
      }
    }
    var parent = $('#' + selector).parent().parent();
    parent.find('.fc-data').val(JSON.stringify(result));

    /*
    // Date and time format based on browsers locales, without seconds.
    // @todo how to make this useful with multiple values?
    var locale_s = startLocal.toLocaleDateString();
    var locale_e = endLocal.toLocaleDateString();
    if (dateonly === false) {
      if (locale_s === locale_e) {
        // If start and end date are the same, only print it once.
        locale_e = endLocal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      else {
        locale_e += ' ' + endLocal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      locale_s += ' ' + startLocal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    // Show some text as not the complete datetime range may be visible.
    var info = Backdrop.t('You selected @start to @end', { '@start': locale_s, '@end': locale_e });
    parent.find('.start-end-display').text(info);
    */

    // Allow different styling, if a slot is selected.
    parent.addClass('slot-selected');
    return result.length;
  };

  resourceTimeslotWidget.resetFieldValue = function (selector) {
    var parent = $('#' + selector).parent().parent();
    parent.find('.fullcalendar-input .fc-start').val('');
    parent.find('.fullcalendar-input .fc-end').val('');
    //parent.find('.fc-data').val('');
    parent.find('.start-end-display').text('');

    parent.removeClass('slot-selected');
  };

})(jQuery);
