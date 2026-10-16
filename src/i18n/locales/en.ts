import type { TranslationTree } from "../types"

import { ru } from "./ru"

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> }

export const en: Widen<typeof ru> = {
  language: {
    label: "Interface language",
    title: "Interface language",
    description: "Choose the application language",
  },

  theme: {
    title: "Interface theme",
    description: "Choose a light, dark, or system theme for the application",
    light: "Light",
    dark: "Dark",
    system: "System",
    switchToDark: "Dark",
    switchToLight: "Light",
  },

  common: {
    cancel: "Cancel",

    save: "Save",

    delete: "Delete",

    edit: "Edit",

    duplicate: "Duplicate",

    retry: "Retry",

    settings: "Settings",

    today: "Today",

    online: "ONLINE",

    offline: "OFFLINE",

    close: "Close",

    add: "Add",

    stop: "Stop",

    pause: "Pause",

    play: "Play",

    resume: "Resume",

    starting: "Starting...",

    stopping: "Stopping...",

    pausing: "Pausing...",

    notAssigned: "Not assigned",

    fileNotAssigned: "No file assigned",

    fileUnavailable: "Audio file unavailable",

    confirm: "Confirm",

    executing: "Working...",

    closeNotification: "Dismiss notification",
  },

  units: {
    kilohertz: "kHz",
    megabyte: "MB",
    decibel: "dB",
    second: "s",
  },

  nav: {
    dashboard: "Dashboard",

    rooms: "Rooms",

    scenarios: "Scenarios",

    schedule: "Schedule",

    audioFiles: "Audio files",

    settings: "Settings",

    logs: "Event log",

    description: "Centralized audio control and automation platform",
  },

  header: {
    systemOk: "System ready",

    systemDegraded: "Partially operational",

    systemUnconfigured: "Setup required",

    systemChecking: "Checking system",

    systemError: "System error",

    backendOffline: "Backend unavailable",

    deviceDisconnected: "Audio device unavailable",

    allLinesOk: "All rooms are configured",

    noRoomsConfigured: "No rooms created yet",

    someRoomsNotConfigured: "Rooms configured: {mapped} of {total}",

    systemUnconfiguredDescription: "Select an audio device",

    systemCheckingDescription: "Retrieving system status",

    deviceDisconnectedDescription: "Check the selected device",

    backendOfflineDescription: "No connection to the server",

    checkConnection: "Check the connection",
  },

  network: {
    backendDisconnected: "Connection to the server was lost",

    backendConnected: "Connection to the server was restored",
  },

  statusBar: {
    audioDevice: "Audio device",

    backend: "Backend",

    outputs: "Outputs",

    available: "available",

    frequency: "Frequency",

    buffer: "Buffer",

    samples: "samples",

    audioSettings: "Audio settings",
  },

  pages: {
    dashboard: {
      title: "Dashboard",

      subtitle: "Centralized audio system control and monitoring",
    },

    rooms: {
      title: "Rooms",

      subtitle: "Manage room audio lines",
    },

    scenarios: {
      title: "Scenarios",

      subtitle: "Create and manage audio scenarios for rooms",
    },

    schedule: {
      title: "Schedule",

      subtitle: "Automatically run scenarios at scheduled times",
    },

    audioFiles: {
      title: "Audio files",

      subtitle: "Manage the system's audio files",
    },

    settings: {
      title: "Settings",

      subtitle: "Configure the audio system and equipment",
    },

    logs: {
      title: "Event log",

      subtitle: "Frontend: UI activity, API, network, and runtime errors",

      records: "Records",
    },
  },

  schedule: {
    weekdays: {
      mon: "Mon",

      tue: "Tue",

      wed: "Wed",

      thu: "Thu",

      fri: "Fri",

      sat: "Sat",

      sun: "Sun",
    },

    repeat: {
      daily: "Daily",

      weekly: "Weekly",

      once: "Once",
    },

    status: {
      active: "Active",

      inactive: "Disabled",
    },

    toolbar: {
      add: "Add schedule",

      time: "Time",

      scenario: "Scenario",

      days: "Days",

      repeat: "Repeat",

      nextRun: "Next run",

      status: "Status",

      enabled: "On",

      noSchedules: "No schedules yet",

      enable: "Enable schedule {id}",

      everyDay: "Mon – Sun",
    },

    dialog: {
      addTitle: "Add schedule",

      editTitle: "Edit schedule",

      time: "Start time",

      scenario: "Scenario",

      chooseScenario: "Select a scenario",

      weekdays: "Days of the week",

      chooseDay: "Select at least one day.",

      repeat: "Repeat",

      enabled: "Enabled",

      autoStart: "Run this schedule automatically",

      saveChanges: "Save changes",

      create: "Create schedule",
    },

    upcoming: {
      title: "Upcoming events",

      all: "All events",

      empty: "No active events",

      emptyDescription: "Add a schedule or enable an existing one.",

      quickActions: "Quick actions",

      runNow: "Run now",

      stopAll: "Stop all",

      test: "Test schedule",
    },

    nextRun: {
      todayAt: "Today at {time}",

      dayAt: "{day} at {time}",

      nextDayAt: "Next {day} at {time}",
    },

    confirmDelete: {
      title: "Delete schedule?",

      description: 'The "{scenario}" schedule at {time} will be deleted. This action cannot be undone.',
    },
  },

  rooms: {
    duplicateSuffix: "copy",

    filters: {
      all: "All",

      playing: "Playing",

      waiting: "Waiting",

      stopped: "Stopped",

      error: "Errors",
    },

    toolbar: {
      add: "Add room",

      showGrid: "Show grid",

      showList: "Show list",

      search: "Search rooms...",
    },

    status: {
      idle: "Ready",

      playing: "Playing",

      paused: "Paused",

      stopped: "Stopped",

      waiting: "Waiting",

      error: "Error",
    },

    table: {
      room: "Room",

      status: "Status",

      file: "File",

      volume: "Volume",

      actions: "Actions",

      playbackProgress: "Playback progress for room {id}",

      roomVolume: "Volume for room {name}",

      roomActions: "Actions for room {name}",
    },

    dialog: {
      editTitle: "Edit room",

      createTitle: "New room",

      editDescription: "Edit settings for room {id}.",

      createDescription: "Add a new room audio line.",

      name: "Name",

      namePlaceholder: "For example, Main Hall",

      nameRequired: "Enter a room name",

      audioFile: "Audio file",

      audioFileHelp:
        "Enter the audio file ID for now. An audio library selector will be added here later.",

      volume: "Volume",
    },

    confirmDelete: {
      title: "Delete room?",

      description:
        'Room "{name}" will be deleted. This action cannot be undone.',
    },

    notifications: {
      saved: "Room saved",

      savedDescription: 'Changes to room "{name}" have been saved.',

      created: "Room created",

      createdDescription: 'Room "{name}" has been added.',

      deleted: "Room deleted",

      deletedDescription: 'Room "{name}" has been deleted.',

      deleteFailed: "Could not delete room",

      deleteUsedByScenario: "This room is used by one or more scenarios. Remove it from those scenario steps, then try again.",

      duplicated: "Room duplicated",

      duplicatedDescription: 'A copy of room "{name}" has been created.',

      playUnavailable: "Rooms cannot be started individually",

      playUnavailableDescription: "Start a scenario or its schedule to begin playback.",

      stopUnavailable: "Rooms cannot be stopped individually",

      stopUnavailableDescription: "Stop the entire scenario or skip the current step on the dashboard.",

      pauseFailed: "Failed to pause playback",

      stopFailed: "Failed to stop playback",
    },

    dashboard: {
      title: "Room status",

      all: "All rooms →",

      empty: "No active rooms",

      showMoreOne: "Show {count} more room",

      showMoreFew: "Show {count} more rooms",

      showMoreMany: "Show {count} more rooms",
    },
  },

  audio: {
    toolbar: {
      add: "Add file",

      opening: "Opening...",

      deleteSelected: "Delete selected",

      fileCount: "Files: {count}",

      storageUsed: "Storage: {size} {unit}",

      search: "Search files...",
    },

    table: {
      selectAll: "Select all files",

      selectFile: "Select {name}",

      name: "Name",

      filename: "File",

      format: "Format",

      sampleRate: "Sample rate",

      duration: "Duration",

      size: "Size",

      gain: "Gain",

      gainFor: "Gain for {name} in decibels",

      pause: "Pause",

      play: "Play",

      playing: "Now playing",

      starting: "Starting...",

      selected: "Selected",
    },

    player: {
      chooseFile: "Select an audio file to listen",

      position: "Playback position",

      progress: "{percent}% played",

      back: "Back 10 seconds",

      forward: "Forward 10 seconds",

      stop: "Stop",

      unmute: "Unmute",

      mute: "Mute",

      volume: "Preview volume",

      previewVolume: "Preview volume",

      gainHint:
        "Gain is applied during playback only. Positive values can cause clipping; the source file is not modified.",
    },


    actions: {
      rename: "Rename",

      delete: "Delete",
    },

    import: {
      drop: "Drop files to import",

      supported: "MP3 and WAV are supported",

      uploading: "Uploading audio file...",

      loadError: "Failed to load audio files",

      noResults: "No results found",

      searchHint: "Try changing your search.",

      empty: "No audio files yet",

      emptyDescription:
        "Add MP3 or WAV files to use them in rooms and scenarios.",

      retry: "Retry",
    },

    rename: {
      title: "Rename audio file",

      description: "Change the display name of the file.",

      name: "Name",

      placeholder: "Audio file name",

      file: "File: {filename}",
    },

    confirmDelete: {
      title: "Delete audio file?",

      description:
        '"{name}" will be removed from the library. This action cannot be undone.',

      selectedTitle: "Delete selected files?",

      selectedDescription:
        "{count} files will be deleted. This action cannot be undone.",
    },

    errors: {
      playback: "Failed to play audio file",

      playbackStart: "Failed to start audio playback",

      upload: "Failed to add audio file",
      volume: "Failed to save audio file volume",

      unsupportedFormat: "Unsupported format",

      supportedFormatsHint: "{name}. Use MP3 or WAV.",

      rename: "Failed to rename audio file",

      emptyName: "Name cannot be empty",

      delete: "Failed to delete audio file",

      deleteSelected: "Failed to delete selected files",
    },

    notifications: {
      added: "Audio file added",

      renamed: "Audio file renamed",

      deleted: "Audio file deleted",

      deletedMany: "Audio files deleted",

      deletedCount: "{count} files deleted",
    },
  },

  scenarios: {
    toolbar: {
      create: "Create scenario",

      duplicate: "Duplicate",

      edit: "Edit",

      delete: "Delete",

      search: "Search scenarios...",
    },

    confirmDelete: {
      title: "Delete scenario?",
      description: 'Scenario "{name}" will be deleted. This action cannot be undone.',
    },
    list: {
      title: "Scenario list",

      noResults: "No results found.",

      step: "step",

      steps: "steps",

      emptyTitle: "No scenarios yet",

      emptyDescription: "Create your first scenario to get started.",

      deleteConfirm: 'Delete scenario "{name}"?',
    },

    editor: {
      notSelected: "Not selected",

      active: "Active",

      inactive: "Inactive",

      descriptionEmpty: "No scenario description",

      duration: "Duration",

      steps: "Steps",

      status: "Status",

      ready: "Scenario is ready to run.",

      needsFixes: "Scenario needs attention",

      moreErrors: "And {count} more...",

      addStep: "Add step",

      totalDuration: "Total duration:",
      saveStatus: {
        scheduled: "Saving…",
        saving: "Saving…",
        saved: "Saved",
        error: "Save failed",
        unsaved: "Changes not saved: check required fields",
      },
      retrySave: "Retry save",
    },

    settings: {
      createTitle: "New scenario",
      createDescription: "Set the main scenario parameters before creating it.",
      editTitle: "Scenario settings",
      editDescription: "Change the main parameters and scenario state.",
      namePlaceholder: "For example, Tour #1",
      descriptionPlaceholder: "Briefly describe the scenario purpose",
      active: "Active",
      general: "General settings",

      name: "Name",

      description: "Description",

      playbackMode: "Playback mode",

      sequential: "Sequential",

      parallel: "Parallel",

      repeat: "Repeat",

      once: "Once",

      loop: "Loop",

      additional: "Additional options",


      stopPrevious: "Stop the previous scenario",
      stopPreviousDescription: "When disabled, the scenario can run alongside active sessions. If a required room is occupied, that step waits until the room is released.",
    },

    steps: {
      emptyTitle: "This scenario has no steps yet",

      emptyDescription: "Add a room and an audio file to build a sequence.",

      step: "Step",

      room: "Room",

      audioFile: "Audio file",

      volume: "Volume",

      delay: "Delay",
      delayBeforeStartSeconds: "Delay before start (sec.)",
      delaySeconds: "Delay (sec.)",

      duration: "Duration",

      chooseRoom: "Select a room",

      chooseAudioFile: "Select an audio file",

      dragHandle: "Drag step",

      volumeFor: "Volume for step {number}",

      deleteTitle: "Delete step?",
      
      deleteDescription: "Step {number} will be removed from the scenario.",
    },

    quickActions: {
      title: "Quick launch",

      run: "Run scenario",

      pause: "Pause",

      stop: "Stop",

      test: "Test run",

      cannotRun: "Scenario cannot be started:",

      testRun: 'Test run of scenario "{name}"',

      notReady: "Scenario is not ready",

      fixErrors: "Fix errors before starting.",
    },

    validation: {
      nameRequired: "Enter a scenario name.",

      stepRequired: "Add at least one step.",

      roomRequired: "Step {number}: no room selected.",

      roomUnavailable: "Step {number}: the selected room is unavailable.",

      roomOutputRequired: "Step {number}: no audio output is assigned to the selected room.",

      roomOutputHint: "No output is assigned to this room in audio settings.",

      outputMappingUnavailable: "Unable to verify audio output mappings. Check audio settings and the backend connection.",

      audioRequired: "Step {number}: no audio file selected.",

      audioUnavailable: "Step {number}: the selected audio file is unavailable.",

      volumeRange: "Step {number}: volume must be between 0 and 100%.",

      delayNonnegative: "Step {number}: delay cannot be negative.",

      durationRequired: "Step {number}: audio duration is unknown.",
    },

    notifications: {
      newName: "New scenario",

      copySuffix: "(copy)",
    },
  },

  dashboard: {
    health: {
      system: "System",

      rooms: "Rooms",

      playingRooms: "{count} playing",

      outputs: "Audio outputs",

      available: "available",

      issues: "Issues",

      systemOk: "system is operational",

      attention: "need attention",
    },

    playback: {
      title: "Current playback",
      parallelTitle: "Parallel scenarios",
      activeCount: "{count} active",
      scenarioFallback: "Scenario",
      stepProgress: "Step {current}/{total}",
      delayCountdown: "Step starts in {seconds} s.",
      waitingForRoom: "The room is occupied by another scenario. This step will restart from the beginning when the room is free.",
      allSteps: "All scenario steps",
      stepDelay: "Delay before start: {seconds} s",
      skipStep: "Skip step",
      stepStatus: { pending: "Queued", playing: "Playing", paused: "Paused", waiting: "Waiting for room", delaying: "Delay", finished: "Finished", stopped: "Skipped/stopped", error: "Error" },
      preparingFirstStep: "Preparing the first step…",
      sessionStatus: { starting: "Starting", playing: "Playing", paused: "Paused", waiting: "Waiting for room" },

      playing: "PLAYING",

      pause: "Pause",

      stop: "Stop",

      openRoom: "Open room",

      empty: "Nothing is playing",

      openRooms: "Open rooms →",
    },

    schedule: {
      title: "Upcoming schedule",

      all: "Full schedule →",

      empty: "No scheduled events",

      open: "Open schedule →",
    },

    quickActions: {
      title: "Quick actions",

      runScenario: "Run scenario",

      testOutputs: "Test outputs",
    },

    audioSystem: {
      title: "Audio system",

      backend: "Backend",

      device: "Device",

      status: "Status",

      outputs: "Outputs",

      frequency: "Sample rate",

      buffer: "Buffer",

      samples: "samples",
    },

    issues: {
      title: "Recent issues",

      openLog: "Open event log",

      empty: "No issues found",

      emergencyStop: "Emergency stop",

      stopDescription: "Stop playback in all active rooms",

      stopAll: "Stop all",
    },

    emergencyStop: {
      title: "Emergency stop",

      description: "Stop playback in all active rooms",

      confirmTitle: "Stop everything?",

      confirmDescription: "Playback will stop in all active rooms.",

      playingNow: "Currently playing",

      room: "room",

      roomsFew: "rooms",

      roomsMany: "rooms",

      stopAll: "Stop all",
    },
  },

  settings: {
    sections: {
      general: {
        title: "General",
        description: "Configure the application's interface.",
      },
      application: {
        title: "Application",
        description: "Configure Audexa startup behavior and event logging.",
      },
      audio: {
        title: "Audio",
        description: "Configure the primary Audexa audio device.",
      },
      outputMapping: {
        title: "Output mapping",
        description: "Map Audexa rooms to physical audio outputs.",
      },
      actions: {
        title: "Settings management",
        description: "Apply or reset the application configuration.",
      },
    },
    audioDevice: {
      title: "Audio device",

      description:
        "Configure the audio device and its parameters",

      device: "Device",

      refresh: "Refresh",

      loading: "Loading devices...",

      notFound: "Audio device not found",

      loadError: "Failed to load audio devices",

      noneFound: "No audio devices found.",

      unsupported: "Audio device support is unavailable on this platform.",

      type: "Type",

      outputs: "Outputs",

      inputs: "Inputs",

      status: "Status",

      online: "Online",

      offline: "Offline",

      outputChannels: "Output channels",
      outputChannelsSummary: "Available channels: {count}",

      outputChannelsUnavailable: "Output channels are unavailable.",

      outputAbbreviation: "OUT",

      sampleRate: "Sample rate (Hz)",

      bufferSize: "Buffer size",

      connected: "Device is connected and working",
      configuredUnavailable: "Configured device (unavailable)",
      unknownType: "Unknown",
      configuredDeviceOffline: "Configured audio device is unavailable",
      configuredDeviceOfflineDescription: "This device remains selected in settings but is not currently detected by Windows. Choose another device manually, or reconnect it and click Refresh.",
      outputDiagnosticsUnavailable: "Output diagnostics are unavailable while the selected device is disconnected.",
    },

    startup: {
      title: "Startup and recovery",
      description: "Available after Audexa is packaged as a standalone desktop application. These options are currently disabled and do not affect system behavior.",
      autoStart: "Start Audexa with Windows",
      recovery: "Recover operation after a failure",
      restoreProfile: "Restore the last configuration",
      errorNotifications: "Notify about startup errors",
    },
    logging: {
      title: "Logging",

      description:
        "Configure logging level and storage settings",

      level:
        "Log level",

      levelDescription:
        "Defines the minimum event level that will be written to the log.",

      storage: {
        title:
          "Log storage",

        localStorage:
          "Application local storage",

        localStorageDescription:
          "Logs are currently stored in the frontend localStorage.",

        file:
          "File storage",

        fileDescription:
          "Logs are stored in the application's log directory.",
      },

      retention: {
        title:
          "Retention",

        value:
          "7 days · up to 2 000 entries",

        description:
          "Entries older than 7 days and entries above the configured limit are removed automatically.",
      },
    },

    lineMapping: {
      configuredDevice: "Device currently in configuration:",
      deviceOffline: "offline",
      noConfiguredDevice: "Not configured",
      editingDifferentDevice: "Editing a different device: {name}. The change takes effect after saving.",

      title: "Line mapping",

      description:
        "Map rooms to physical audio device outputs",

      summary: "Rooms: {rooms} · outputs: {outputs}",

      refresh: "Refresh",

      backendUnavailable: "Unable to connect to the backend",

      reconnecting: "Retrying automatically every few seconds.",

      assigned: "Assigned",

      free: "Free",

      conflicts: "Conflicts",

      rooms: "Rooms",

      room: "Room",

      output: "Output",

      clearOutput: "Clear output for room “{name}”",

      selectDevice: "Select an audio device to configure its output lines.",

      noOutputs: "The selected device has no available output channels.",

      status: "Status",

      conflict: "Conflict",

      ok: "Assigned",

      testOutput: "Test output",

      testNamedOutput: "Test {name}",

      specialLines: "Special lines",

      translation: "Simultaneous interpretation",

      dedicatedOutput: "Dedicated physical output",

      unsaved: "You have unsaved changes",

      saved: "All changes saved",

      undo: "Undo",

      save: "Save",

      saving: "Saving...",

      diagnosticsTitle: "Audio output diagnostics",
      diagnosticsDescription: "Send a short test signal to available physical outputs.",
      diagnosticsMode: "Signal",
      diagnosticsVoice: "Voice identification",
      diagnosticsVoiceShort: "Voice",
      diagnosticsTone: "Test tone",
      diagnosticsDuration: "Duration",
      diagnosticsDuration500: "0.5 {unit}",
      diagnosticsDuration800: "0.8 {unit}",
      diagnosticsDuration1000: "1.0 {unit}",
      diagnosticsVolume: "Volume",
      diagnosticsVolumeMinus20: "-20 {unit}",
      diagnosticsVolumeMinus12: "-12 {unit}",
      diagnosticsVolumeMinus6: "-6 {unit}",
      diagnosticsTest: "Test",
      diagnosticsTestAssigned: "Test assigned",
      diagnosticsTestAll: "Test all",
      diagnosticsTesting: "Testing...",
      diagnosticsSignalSent: "Signal sent",
      diagnosticsFailed: "Failed",
      diagnosticsTestFailed: "Output test failed",
      diagnosticsBackendRequired: "Audio diagnostics backend is required for testing.",
      diagnosticsNoAssigned: "No assigned outputs to test.",
      diagnosticsSignalNotice: "A successful result means Audexa sent a signal to the selected output. It does not confirm that the amplifier or physical speaker is working.",
      outputFallback: "Output",
      saveSuccess: "Audio settings saved",
      saveFailed: "Failed to save audio settings",
      saveFailedDescription: "Check the backend connection and try again.",
    },

    actions: {
      save: "Save settings",

      reset: "Restore defaults",
    },
  },

  logs: {
    messages: {
      unknownRuntimeError: "Unknown JavaScript error",

      unhandledPromise: "Unhandled promise rejection",

      connectionRestored: "Network connection restored",

      noNetwork: "The browser reports that it is offline",

      appStarted: "Audexa frontend started",

      contextSerializationError: "Failed to serialize log context",

      backendReconnected: "Connection to the server was restored",

      backendConnectionLost: "Connection to the server was lost; reconnecting",

      backendOffline: "The server is not responding after repeated connection attempts",

      requestTimedOut: "Request timed out: {method} {path}",

      connectionFailed: "Could not connect to the server",

      requestFailed: "Request {method} {path} failed with status {status}: {message}",
    },

    columns: {
      time: "TIME",

      level: "LEVEL",

      source: "SOURCE",

      event: "EVENT",

      message: "MESSAGE",
    },

    empty: "No entries",

    confirmClear: {
      title: "Clear logs?",

      description: "All log entries will be deleted. This action cannot be undone.",
    },

    filters: {
      all: "All",

      info: "Info",

      warning: "Warnings",

      error: "Errors",

      search: "Search logs...",

      refresh: "Refresh",

      export: "Export",

      clear: "Clear",

      additional: "Additional filters",

      includeDebug: "Include DEBUG",
    },
  },
} satisfies Widen<typeof ru> & TranslationTree
