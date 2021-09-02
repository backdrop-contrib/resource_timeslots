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
        var canAddItems = true;
        var selectFormItem = $(this).parent('.form-item').prev('.form-type-select');
        var resourceId = selectFormItem.find('option:selected').val();
        var resourceTitle = selectFormItem.find('option:selected').text();
        var reserved = [];
        var currentItem = null;
        var fieldName = $(this).attr('data-fieldname');
        var widgetSettings = settings.resource_timeslots_setup[fieldName];
        var validRange = widgetSettings.validRange;
        if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
          reserved = widgetSettings.reserved[resourceId];
        }
        var dateOnly = false;
        if (widgetSettings.calendarType === 'dayGridMonth') {
          dateOnly = true;
        }

        if (existingStartTs.length > 0) {
          // Get values from hidden field, should be numbers to calculate.
          var existingEndTs = Number(inputContainer.find('.fc-end').val());
          existingStartTs = Number(existingStartTs);
          // When Fullcalendar considers timezone, it "shifts" all dates, so we
          // have to do the same in the other direction to end up with the
          // correct timezone based on our Unix timestamps.
          // @todo This may have side effects.
          var offset_s = new Date(existingStartTs * 1000).getTimezoneOffset();
          var offset_e = new Date(existingEndTs * 1000).getTimezoneOffset();

          currentItem = {
            start: new Date((existingStartTs - (offset_s * 60)) * 1000),
            end: new Date((existingEndTs - (offset_e * 60)) * 1000),
            id: 'current-item'
          };

          dateInitial = new Date(existingStartTs * 1000);
          canAddItems = false;
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
          events: reserved,
          eventOverlap: false,
          selectOverlap: false,
          editable: true,
          selectable: canAddItems,
          validRange: validRange,
          initialDate: dateInitial,
          slotDuration: widgetSettings.minSlotSize,
          select: function(info) {
            calendar.addEvent({
              title: resourceTitle,
              start: info.startStr,
              end: info.endStr,
              id: 'current-item'
            });
            resourceTimeslotWidget.updateFieldValue(calendarId, info.start, info.end, dateOnly);
            // We stop after one added event, one value per field delta.
            calendar.setOption('selectable', false);
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
              calendar.setOption('selectable', true);
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

        if (currentItem !== null) {
          calendar.addEvent(currentItem);
          // Make sure existing items are always visible, even if in the past.
          calendar.setOption('firstDay', currentItem.start.getDay());
          var rangeStart = new Date(widgetSettings.validRange.start);
          if (rangeStart.getTime() > currentItem.start.getTime()) {
            var pastRange = {
              start: currentItem.start.toUTCString(),
              end: widgetSettings.validRange.end
            };
            calendar.setOption('validRange', pastRange);
          }
        }
        calendar.render();

        selectFormItem.find('select').change(function () {
          // @todo Put this in a reusable function?
          resourceId = $(this).find('option:selected').val();
          resourceTitle = $(this).find('option:selected').text();
          reserved = [];
          if (widgetSettings.reserved.hasOwnProperty(resourceId)) {
            reserved = widgetSettings.reserved[resourceId];
          }
          // When switching resources, reserved values are different. Delete the
          // current event object to prevent unattended overlap.
          var current = calendar.getEventById('current-item');
          if (current !== null) {
            current.remove();
            calendar.setOption('selectable', true);
          }
          calendar.setOption('events', reserved);
          calendar.render();
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
   * @param object start
   *   JS Date object.
   * @param object end
   *   JS Date object.
   */
  resourceTimeslotWidget.updateFieldValue = function (selector, start, end, dateonly) {
    // Warning: start/end objects get the wrong UTC offset (fullcalendar), so we
    // have to calculate from truncated ISO string to end up with the right
    // timezone.
    var startStr = start.toISOString().substr(0, 19);
    var endStr = end.toISOString().substr(0, 19);
    var startDate = new Date(startStr);
    var endDate = new Date(endStr);
    var timestamps = {
      start: startDate.getTime() / 1000,
      end: endDate.getTime() / 1000
    };
    var parent = $('#' + selector).parent().parent();
    parent.find('.fullcalendar-input .fc-start').val(timestamps.start);
    parent.find('.fullcalendar-input .fc-end').val(timestamps.end);

    // Date and time format based on browsers locales, without seconds.
    var locale_s = startDate.toLocaleDateString();
    var locale_e = endDate.toLocaleDateString();
    if (dateonly === false) {
      if (locale_s === locale_e) {
        // If start and end date are the same, only print it once.
        locale_e = endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      else {
        locale_e += ' ' + endDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      locale_s += ' ' + startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    // Show some text as not the complete datetime range may be visible.
    var info = Backdrop.t('You selected @start to @end', { '@start': locale_s, '@end': locale_e });
    parent.find('.start-end-display').text(info);
  };

  resourceTimeslotWidget.resetFieldValue = function (selector) {
    var parent = $('#' + selector).parent().parent();
    parent.find('.fullcalendar-input .fc-start').val('');
    parent.find('.fullcalendar-input .fc-end').val('');
    parent.find('.start-end-display').text('');
  };

})(jQuery);
