// Gerado por scripts/sync-local-config.cjs a partir de config/*.json.
window.NathGame.localConfig = {
  "characters": {
    "padrao": {
      "name": "Nathzinha Padrão",
      "artId": "original",
      "start": 1,
      "positions": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        17,
        18,
        19,
        20,
        22
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM03",
        "CAM04",
        "CAM05",
        "CAM06",
        "CAM07",
        "CAM08",
        "CAM10",
        "CAM11",
        "CAM12"
      ],
      "interval": 23,
      "reaction": 3,
      "routes": {
        "CV": 19,
        "CC": 19,
        "EL": 16,
        "EC": 15,
        "EV": 10,
        "ES": 21
      },
      "audioModifier": -50,
      "doorChance": [
        70,
        98
      ]
    },
    "gotica": {
      "name": "Nathzinha Gótica",
      "artId": "gotica",
      "start": 1,
      "positions": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        9,
        10,
        12,
        13,
        14,
        15,
        17,
        18,
        19
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM03",
        "CAM04",
        "CAM05",
        "CAM06",
        "CAM07",
        "CAM08",
        "CAM10",
        "CAM11",
        "CAM12"
      ],
      "interval": 26,
      "reaction": 4,
      "routes": {
        "CV": 30,
        "CC": 30,
        "EL": 20,
        "EC": 10,
        "EV": 10
      },
      "audioModifier": 35,
      "staticChance": [
        75,
        99
      ]
    },
    "yandere": {
      "name": "Nathzinha Yandere",
      "artId": "yandere",
      "start": 1,
      "positions": [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        9,
        10,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        21
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM03",
        "CAM04",
        "CAM05",
        "CAM06",
        "CAM07",
        "CAM08",
        "CAM09",
        "CAM10",
        "CAM11",
        "CAM12"
      ],
      "interval": 21,
      "reaction": 4,
      "routes": {
        "CV": 22,
        "CC": 22,
        "EL": 10,
        "EC": 14,
        "EV": 8,
        "EE": 24
      },
      "audioModifier": 75,
      "staticChance": [
        75,
        99
      ],
      "firstIntervalReduction": [
        0.3,
        0.6
      ],
      "watchedNeighborBonus": 0.1
    },
    "gatinha": {
      "name": "Nathzinha Gatinha",
      "artId": "platinada",
      "start": 3,
      "positions": [
        3,
        4,
        5,
        7,
        9,
        10,
        12,
        13,
        14,
        15,
        23,
        24,
        25,
        26
      ],
      "cameras": [
        "CAM01",
        "CAM02",
        "CAM04",
        "CAM06",
        "CAM07",
        "CAM08"
      ],
      "interval": 19,
      "reaction": 4,
      "routes": {
        "CV": 30,
        "EL": 30,
        "AR": 40
      },
      "firstRoutes": {
        "CV": 50,
        "EL": 50
      },
      "audioModifier": 35,
      "hidingPlaces": [
        23,
        24,
        25
      ],
      "hidingBonus": 5,
      "extraIntervalReduction": 5
    },
    "maid": {
      "name": "Nathzinha Maid",
      "artId": "maid",
      "start": 16,
      "positions": [
        6,
        7,
        13,
        14,
        15,
        16,
        17,
        18
      ],
      "cameras": [
        "CAM05",
        "CAM06",
        "CAM09",
        "CAM10",
        "CAM11"
      ],
      "interval": 30,
      "reaction": 2,
      "targetBonus": [
        10,
        18
      ],
      "audioModifier": 35,
      "initialStationaryAttempts": 1,
      "initialIntervalReduction": 10
    }
  },
  "controls": {
    "closetTransitionsMs": {
      "enter": {
        "swap": 980,
        "duration": 1450
      },
      "exit": {
        "swap": 650,
        "duration": 1040
      }
    },
    "jumpscare": {
      "blackoutMs": 110,
      "cycleMs": 960,
      "clownBottomCycleMs": 1280,
      "finalHoldMs": 250,
      "flashMs": 230,
      "imageLoadWaitMs": 2000,
      "volume": 0.55
    },
    "radioTracks": [
      "caramelldansen.mp3",
      "shikairo-days.mp3",
      "kawaikute-gomen.mp3"
    ],
    "menuMusic": {
      "startSeconds": 27,
      "fadeSeconds": 2,
      "initialVolume": 0.08,
      "volume": 0.58
    },
    "observation": {
      "leftPanFraction": 0.55,
      "corridorPanFraction": 0.5
    },
    "unillustratedCameraPositions": []
  },
  "effects": {
    "cameraAudio": {
      "duration": 3,
      "cooldown": 9,
      "factors": [
        1,
        1,
        0.25
      ]
    },
    "static": {
      "duration": 2,
      "visual": {
        "gotica": {
          "durationMs": 2000,
          "intensity": 0.88
        },
        "gate": {
          "durationMs": 650,
          "intensity": 0.73
        },
        "switch": {
          "durationMs": 340,
          "intensity": 0.42
        }
      }
    },
    "imageCache": {
      "limit": 16,
      "parallel": 3
    },
    "corridorAttackSound": {
      "files": [
        "audio/effects/invasion/corredor/metal01.mp3",
        "audio/effects/invasion/corredor/metal02.mp3",
        "audio/effects/invasion/corredor/metal03.mp3",
        "audio/effects/invasion/corredor/metal04.mp3",
        "audio/effects/invasion/corredor/metal05.mp3"
      ],
      "volume": 0.32
    },
    "stockAttackSound": {
      "files": [
        "audio/effects/invasion/estoque/risada-1.wav",
        "audio/effects/invasion/estoque/risada-2.mp3"
      ],
      "volume": 0.32
    },
    "yandereSabotageSound": {
      "file": "audio/characters/yandere/sabotagem.ogg",
      "volume": 0.45
    },
    "yandereSurpriseSound": {
      "file": "audio/characters/yandere/risada-surpresa.wav",
      "volume": 0.32
    },
    "padraoInvasionSound": {
      "files": [
        "audio/characters/padrao/invasao-1.ogg",
        "audio/characters/padrao/invasao-2.ogg"
      ],
      "volume": 0.45
    },
    "clownWarningSound": {
      "volume": 0.45,
      "pan": 1
    },
    "mapGateCloseSound": {
      "G09": {
        "volume": 0.31,
        "pan": -0.82
      },
      "G04": {
        "volume": 0.13,
        "pan": 0.08
      },
      "G02": {
        "volume": 0.19,
        "pan": 0.14
      },
      "G05": {
        "volume": 0.07,
        "pan": 0.42
      },
      "G03": {
        "volume": 0.09,
        "pan": 0.58
      }
    },
    "smoresRoomSound": {
      "file": "audio/characters/smores/smores-room.wav",
      "volume": 0.45
    },
    "invasion": {
      "file": "audio/effects/invasion/invasao.ogg",
      "volume": 0.45,
      "fadeOutSeconds": 1,
      "flashMs": 120
    },
    "closetVentSound": {
      "file": "audio/characters/gatinha/closet-vent.mp3",
      "volume": 0.45
    },
    "flashlight": {
      "corridorFlickerMs": 160,
      "corridorIntervalFactor": 1.25,
      "modifiers": {
        "gotica": {
          "secondsToMax": 8,
          "advanceDelta": -0.65
        },
        "gatinha": {
          "secondsToMax": 6,
          "advanceDelta": 0.65
        }
      },
      "decayPerSecond": 0.2,
      "minimumAdvance": 0.05,
      "maximumAdvance": 0.995
    },
    "noise": {
      "rates": {
        "radio": 6,
        "computer": 0.75,
        "viewMoving": 0.25
      },
      "events": {
        "closetEnter": 5,
        "closetExit": 5,
        "flashlightOn": 8,
        "computerOn": 12,
        "workshopDoorClose": 8
      },
      "corridorMultiplier": 0.8,
      "decay": 3,
      "max": 100
    }
  },
  "map": {
    "positions": [
      {
        "id": 1,
        "name": "Palco",
        "cameras": [
          "CAM03"
        ],
        "room": "salao",
        "point": [
          19.7,
          20.3
        ]
      },
      {
        "id": 2,
        "name": "Meio do salão",
        "cameras": [
          "CAM03"
        ],
        "room": "salao",
        "point": [
          19,
          14.8
        ]
      },
      {
        "id": 3,
        "name": "Fundo do salão (CAM 04)",
        "cameras": [
          "CAM04"
        ],
        "room": "salao",
        "point": [
          24.2,
          8.2
        ]
      },
      {
        "id": 4,
        "name": "Fliperama",
        "cameras": [
          "CAM07"
        ],
        "room": "fliperama",
        "point": [
          30.3,
          6
        ]
      },
      {
        "id": 5,
        "name": "Recepção",
        "cameras": [
          "CAM02"
        ],
        "room": "recepcao",
        "point": [
          15.8,
          2.6
        ]
      },
      {
        "id": 6,
        "name": "VIP 1",
        "cameras": [
          "CAM05"
        ],
        "room": "vip1",
        "point": [
          10.6,
          18.5
        ]
      },
      {
        "id": 7,
        "name": "VIP 2",
        "cameras": [
          "CAM06"
        ],
        "room": "vip2",
        "point": [
          10.2,
          11.2
        ]
      },
      {
        "id": 8,
        "name": "Saída da recepção",
        "cameras": [
          "CAM02"
        ],
        "room": "recepcao",
        "point": [
          19,
          0.65
        ]
      },
      {
        "id": 9,
        "name": "Lojinha",
        "cameras": [
          "CAM01"
        ],
        "room": "loja",
        "point": [
          6,
          2.5
        ]
      },
      {
        "id": 10,
        "name": "Estoque",
        "cameras": [
          "CAM08"
        ],
        "room": "estoque",
        "point": [
          2.45,
          12.9
        ]
      },
      {
        "id": 11,
        "name": "Saída do estoque",
        "cameras": [
          "CAM08"
        ],
        "room": "estoque",
        "point": [
          0.65,
          11.5
        ]
      },
      {
        "id": 12,
        "name": "Porta esquerda da sala de controle",
        "cameras": [],
        "room": "estoque",
        "point": [
          3.1,
          8.05
        ]
      },
      {
        "id": 13,
        "name": "Sala de controle (ataque)",
        "cameras": [],
        "room": "controle",
        "point": [
          6.05,
          7.9
        ]
      },
      {
        "id": 14,
        "name": "Corredor central — frente",
        "cameras": [],
        "room": "corredor_servico",
        "point": [
          5.75,
          11.1
        ]
      },
      {
        "id": 15,
        "name": "Corredor central — fundo",
        "cameras": [],
        "room": "corredor_servico",
        "point": [
          5.65,
          19.1
        ]
      },
      {
        "id": 16,
        "name": "Serviço (Parts & Service)",
        "cameras": [
          "CAM09"
        ],
        "room": "servico",
        "point": [
          2.15,
          19
        ]
      },
      {
        "id": 17,
        "name": "Cozinha",
        "cameras": [
          "CAM10"
        ],
        "room": "cozinha",
        "point": [
          6.8,
          26.2
        ]
      },
      {
        "id": 18,
        "name": "Retirada de comida",
        "cameras": [
          "CAM11"
        ],
        "room": "retirada",
        "point": [
          16.6,
          26.65
        ]
      },
      {
        "id": 19,
        "name": "Corredor da CAM 12",
        "cameras": [
          "CAM12"
        ],
        "room": "corredor_servico",
        "point": [
          23.8,
          23.3
        ]
      },
      {
        "id": 20,
        "name": "Sala da Nath",
        "cameras": [],
        "room": "nathzinha",
        "point": [
          21.5,
          26.2
        ]
      },
      {
        "id": 21,
        "name": "Elétrica",
        "cameras": [],
        "room": "eletrica",
        "point": [
          27.5,
          26.2
        ]
      },
      {
        "id": 22,
        "name": "Saída do corredor",
        "cameras": [],
        "room": "corredor_servico",
        "point": [
          31.5,
          27.3
        ]
      },
      {
        "id": 23,
        "name": "Ponto cego do salão principal",
        "cameras": [],
        "room": "salao",
        "point": [
          25.9,
          19
        ]
      },
      {
        "id": 24,
        "name": "Banheiro — esconderijo da Gatinha",
        "cameras": [],
        "room": "wc_m",
        "point": [
          29.1,
          16.7
        ]
      },
      {
        "id": 25,
        "name": "Escondida na VIP 2",
        "cameras": [],
        "room": "vip2",
        "point": [
          10.2,
          15.1
        ]
      },
      {
        "id": 26,
        "name": "Ventilação do armário",
        "cameras": [],
        "room": "controle",
        "point": [
          7.5,
          7.9
        ]
      }
    ],
    "edges": [
      {
        "from": 1,
        "to": 2,
        "type": "room"
      },
      {
        "from": 2,
        "to": 3,
        "type": "room"
      },
      {
        "from": 2,
        "to": 6,
        "type": "gate",
        "gateId": "G05"
      },
      {
        "from": 2,
        "to": 7,
        "type": "gate",
        "gateId": "G03"
      },
      {
        "from": 1,
        "to": 19,
        "type": "gate",
        "gateId": "G06"
      },
      {
        "from": 3,
        "to": 5,
        "type": "gate",
        "gateId": "G08"
      },
      {
        "from": 3,
        "to": 7,
        "type": "gate",
        "gateId": "G03"
      },
      {
        "from": 3,
        "to": 23,
        "type": "room"
      },
      {
        "from": 5,
        "to": 8,
        "type": "room"
      },
      {
        "from": 5,
        "to": 9,
        "type": "free",
        "openingId": "P01"
      },
      {
        "from": 6,
        "to": 15,
        "type": "gate",
        "gateId": "G04"
      },
      {
        "from": 7,
        "to": 15,
        "type": "gate",
        "gateId": "G02"
      },
      {
        "from": 7,
        "to": 25,
        "type": "room"
      },
      {
        "from": 8,
        "to": 11,
        "type": "exterior",
        "exits": [
          "EXT01",
          "EXT02"
        ],
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 8,
        "to": 22,
        "type": "exterior",
        "exits": [
          "EXT01",
          "EXT03"
        ],
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 9,
        "to": 10,
        "type": "gate",
        "gateId": "G09"
      },
      {
        "from": 10,
        "to": 11,
        "type": "room"
      },
      {
        "from": 10,
        "to": 12,
        "type": "room"
      },
      {
        "from": 10,
        "to": 15,
        "type": "free",
        "openingId": "P03"
      },
      {
        "from": 11,
        "to": 22,
        "type": "exterior",
        "exits": [
          "EXT02",
          "EXT03"
        ],
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 12,
        "to": 13,
        "type": "free",
        "openingId": "P02"
      },
      {
        "from": 14,
        "to": 13,
        "type": "gate",
        "gateId": "G01",
        "oneWay": true
      },
      {
        "from": 14,
        "to": 15,
        "type": "room"
      },
      {
        "from": 15,
        "to": 16,
        "type": "gate",
        "gateId": "P04"
      },
      {
        "from": 15,
        "to": 17,
        "type": "free",
        "openingId": "P07"
      },
      {
        "from": 15,
        "to": 18,
        "type": "free",
        "openingId": "P10"
      },
      {
        "from": 16,
        "to": 17,
        "type": "free",
        "openingId": "P06"
      },
      {
        "from": 17,
        "to": 18,
        "type": "free",
        "openingId": "P09"
      },
      {
        "from": 19,
        "to": 18,
        "type": "free",
        "openingId": "P10"
      },
      {
        "from": 19,
        "to": 20,
        "type": "free",
        "openingId": "P11",
        "actors": [
          "padrao"
        ]
      },
      {
        "from": 19,
        "to": 21,
        "type": "free",
        "openingId": "P12",
        "actors": [
          "yandere"
        ]
      },
      {
        "from": 19,
        "to": 22,
        "type": "room"
      },
      {
        "from": 3,
        "to": 4,
        "type": "gate",
        "gateId": "G07",
        "via": [
          "P14"
        ],
        "through": [
          "circ_wc"
        ]
      },
      {
        "from": 3,
        "to": 24,
        "type": "gate",
        "gateId": "G07",
        "via": [
          "P15"
        ],
        "through": [
          "circ_wc"
        ],
        "actors": [
          "gatinha"
        ]
      },
      {
        "from": 4,
        "to": 24,
        "type": "free",
        "openingId": "P14",
        "via": [
          "P15"
        ],
        "through": [
          "circ_wc"
        ],
        "actors": [
          "gatinha"
        ]
      },
      {
        "from": 3,
        "to": 26,
        "type": "vent",
        "oneWay": true,
        "actors": [
          "gatinha"
        ],
        "route": "AR"
      }
    ],
    "stage": 1,
    "office": 13,
    "left": 12,
    "front": 14,
    "back": 15,
    "leftApproach": 10,
    "closetVent": 26,
    "workshopGate": "P04",
    "capacities": {
      "12": 1,
      "14": 2,
      "15": 3,
      "16": 1
    },
    "maxClosedMapGates": 3
  },
  "movement": {
    "jitter": {
      "min": -1.5,
      "max": 1.5
    },
    "weight": 1,
    "stayFactor": 0.25,
    "backtrackFactor": 0.5,
    "retryWindow": 5,
    "failedIntervalFactor": 0.35,
    "failedModifierRetention": 0.75,
    "routes": {
      "bonus": [
        25,
        40
      ],
      "padraoBonus": [
        32,
        48
      ],
      "perMove": [
        3,
        5
      ],
      "padraoPerMove": [
        4,
        6
      ],
      "huntBonus": 25,
      "huntPenalty": 20,
      "blockedProgressRetention": 0.5,
      "definitions": {
        "CV": {
          "objective": "corridor",
          "target": 15,
          "paths": [
            [
              6,
              15
            ],
            [
              7,
              15
            ]
          ]
        },
        "CC": {
          "objective": "corridor",
          "target": 15,
          "paths": [
            [
              19,
              18,
              15
            ],
            [
              19,
              18,
              17,
              15
            ]
          ]
        },
        "EL": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              5,
              9,
              10
            ]
          ]
        },
        "EC": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              19,
              18,
              15,
              10
            ],
            [
              19,
              18,
              17,
              15,
              10
            ]
          ]
        },
        "EV": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              6,
              15,
              10
            ],
            [
              7,
              15,
              10
            ]
          ]
        },
        "AR": {
          "objective": "closetVent",
          "target": 26,
          "paths": [
            [
              3,
              26
            ]
          ]
        },
        "ES": {
          "objective": "stock",
          "target": 10,
          "paths": [
            [
              8,
              11,
              10
            ],
            [
              22,
              11,
              10
            ]
          ]
        },
        "EE": {
          "objective": "electrical",
          "target": 21
        }
      }
    },
    "attack": {
      "corridor": {
        "gotica": {
          "approach": [
            0.6,
            0.85
          ],
          "entry": [
            0.8,
            0.99
          ]
        },
        "yandere": {
          "approach": [
            0.6,
            0.85
          ],
          "entry": [
            0.8,
            0.99
          ]
        },
        "gatinha": {
          "approach": [
            0.15,
            0.45
          ],
          "entry": [
            0.25,
            0.65
          ]
        },
        "maid": {
          "approach": [
            0.65,
            0.76
          ],
          "entry": [
            0.85,
            0.96
          ]
        },
        "padrao": {
          "approach": [
            0.45,
            0.8
          ],
          "entry": [
            0.6,
            0.98
          ]
        }
      },
      "stock": {
        "approach": [
          0.25,
          0.94
        ],
        "entry": [
          0.5,
          0.99
        ],
        "observationPenalty": 0.35,
        "minimumObservedAdvance": 0.05
      },
      "stayShare": 0.3
    },
    "retreat": {
      "stock": [
        9,
        6,
        11
      ],
      "corridor": [
        17,
        6,
        7
      ],
      "office": [
        6,
        7,
        9,
        11
      ]
    },
    "recovery": {
      "intervalFactor": 1.25,
      "freeMoves": 1
    },
    "difficulty": {
      "maxIntervalReduction": 0.55,
      "maxReactionReduction": 0.2
    }
  },
  "night": {
    "rulesVersion": "1.1.3",
    "clock": {
      "fastSanity": 90,
      "slowSanity": 10,
      "fastSecondsPerHour": 60,
      "slowSecondsPerHour": 240
    },
    "startHour": 12,
    "hoursToWin": 6,
    "powerEnabled": true,
    "sanityEnabled": true,
    "defaultLevel": 0,
    "levels": [
      0,
      11
    ],
    "campaignMaxLevel": 11,
    "campaign": [
      {
        "movementDelay": 45,
        "maxClosedGates": 0,
        "secondsPerHour": 50,
        "hoursToWin": 6,
        "powerEnabled": false,
        "sanityEnabled": false,
        "levels": {
          "gotica": 5,
          "yandere": 4,
          "palhaca": 1,
          "padrao": 0,
          "gatinha": 0,
          "maid": 0,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 40,
        "maxClosedGates": 1,
        "secondsPerHour": 55,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": false,
        "levels": {
          "gotica": 8,
          "yandere": 4,
          "palhaca": 2,
          "padrao": 1,
          "gatinha": 0,
          "maid": 0,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 35,
        "maxClosedGates": 2,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 4,
          "yandere": 9,
          "palhaca": 2,
          "padrao": 2,
          "gatinha": 0,
          "maid": 1,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 30,
        "maxClosedGates": 3,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 5,
          "yandere": 2,
          "palhaca": 3,
          "padrao": 3,
          "gatinha": 2,
          "maid": 9,
          "smores": 0,
          "shadow": 0
        }
      },
      {
        "movementDelay": 25,
        "maxClosedGates": 4,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 5,
          "yandere": 3,
          "palhaca": 5,
          "padrao": 4,
          "gatinha": 10,
          "maid": 2,
          "smores": 3,
          "shadow": 0
        }
      },
      {
        "movementDelay": 20,
        "maxClosedGates": 5,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 6,
          "yandere": 5,
          "palhaca": 8,
          "padrao": 5,
          "gatinha": 4,
          "maid": 4,
          "smores": 5,
          "shadow": 1
        }
      },
      {
        "movementDelay": 15,
        "maxClosedGates": 6,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 11,
          "yandere": 11,
          "palhaca": 3,
          "padrao": 6,
          "gatinha": 5,
          "maid": 5,
          "smores": 3,
          "shadow": 2
        }
      },
      {
        "movementDelay": 10,
        "maxClosedGates": 7,
        "secondsPerHour": 60,
        "hoursToWin": 6,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 6,
          "yandere": 6,
          "palhaca": 5,
          "padrao": 10,
          "gatinha": 5,
          "maid": 6,
          "smores": 10,
          "shadow": 10
        }
      },
      {
        "movementDelay": 10,
        "maxClosedGates": 8,
        "secondsPerHour": 60,
        "hoursToWin": 7,
        "powerEnabled": true,
        "sanityEnabled": true,
        "levels": {
          "gotica": 7,
          "yandere": 7,
          "palhaca": 6,
          "padrao": 11,
          "gatinha": 7,
          "maid": 7,
          "smores": 3,
          "shadow": 11
        }
      }
    ]
  },
  "power": {
    "initial": 100,
    "computerDrain": 0.025,
    "computerIdleFactor": 0.5,
    "gateDrain": 0.3,
    "radioDrain": 0.06,
    "flashlightDrain": 0.12,
    "eventDrain": {
      "electricalFault": 10
    },
    "radioGraceSeconds": 30,
    "flashlightGraceSeconds": 60,
    "warningBelow": 15
  },
  "sanity": {
    "initial": 100,
    "loss": {
      "camera": 0.2,
      "yandereCamera": 0.25,
      "direct": 0.45,
      "centralGate": 0.12,
      "closet": 0.6,
      "invasion": 2.5
    },
    "cameraLossOverrides": {
      "yandere": {
        "CAM10": 0.5,
        "CAM07": 0.5,
        "CAM12": 0.5
      },
      "padrao": {
        "CAM10": 0.4
      },
      "gotica": {
        "CAM11": 0.4,
        "CAM04": 0.4
      }
    },
    "eventLoss": {
      "closetEnter": 2,
      "electricalFault": 5,
      "yandereCameraScare": 15
    },
    "recovery": {
      "music": 0.1,
      "passive": 0.04
    },
    "hallucinations": {
      "blur": {
        "below": 75,
        "interval": 20,
        "chance": 10,
        "chancePerPoint": 1,
        "duration": 1.25
      },
      "laugh": {
        "below": 40,
        "interval": 30,
        "chance": 40
      },
      "apparition": {
        "below": 30,
        "interval": 30,
        "chance": 45,
        "duration": 1.5
      }
    },
    "blackoutLossMultiplier": 2
  },
  "shadow": {
    "name": "Nathzinha Shadow",
    "firstLevel": {
      "sanityLimit": 45,
      "chance": 9,
      "searchSeconds": 15
    },
    "lastLevel": {
      "sanityLimit": 65,
      "chance": 12,
      "searchSeconds": 10
    },
    "chancePerSanityPoint": 1,
    "manifestSeconds": 1.15,
    "foundSeconds": 0.65,
    "jumpscareMs": 1200,
    "officeArt": "./public/images/shadow/office.webp",
    "sprite": "./public/images/shadow/camera-sprite.webp",
    "jumpscare": "./public/images/jumpscares/shadow.webp"
  },
  "threats": {
    "yandereCameraScare": {
      "observationSeconds": [
        8,
        3
      ],
      "durationSeconds": 1.21,
      "image": "./public/images/jumpscares/yandere-camera.gif",
      "sound": "audio/jumpscares/yandere-camera.ogg"
    },
    "yandereSurprise": {
      "inactivity": {
        "min": 55,
        "max": 65
      },
      "sanityThreshold": 75,
      "warningSeconds": 1,
      "firstLevel": 5,
      "secondLevel": 8,
      "uses": {
        "first": 1,
        "second": 2,
        "max": 3
      }
    },
    "smores": {
      "name": "Smores",
      "radioSeconds": 18,
      "radioResetSeconds": {
        "min": 2,
        "max": 4
      },
      "roomSoundSeconds": 4.5,
      "roomSoundChance": 0.65,
      "silenceSeconds": 10,
      "ignoredSeconds": 15,
      "finalSeconds": 10,
      "quietRoomSpeed": 2,
      "targetBonusMultiplier": 2,
      "level1": {
        "ventChance": 15,
        "roomSeconds": 35,
        "intervalReduction": 1,
        "reactionReduction": 0.3
      },
      "maxLevel": {
        "ventChance": 20,
        "roomSeconds": 50,
        "intervalReduction": 2,
        "reactionReduction": 0.4
      }
    },
    "closetVent": {
      "waitSeconds": 15,
      "lightSeconds": {
        "min": 1.5,
        "max": 3.5
      }
    },
    "attack": {
      "secondReactionFactor": 0.75,
      "padraoReactionStep": 0.05,
      "padraoMinReactionFactor": 0.05,
      "stay": 5.5,
      "lateStay": 8.5,
      "lateThreshold": 0.8,
      "jitter": {
        "min": -2.5,
        "max": 2.5
      }
    },
    "clown": {
      "name": "Palhaça",
      "initial": 1,
      "min": 1,
      "max": 100,
      "stages": [
        1,
        20,
        50,
        80
      ],
      "entryDeathAbove": 82,
      "floorPerEntry": 8,
      "growth": [
        0.8,
        1.56
      ],
      "warningAt": 79,
      "closetGrowthFactor": 3.25,
      "litClosetGrowthFactor": 1.625,
      "musicReduction": 2
    }
  }
};
