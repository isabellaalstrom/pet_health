# Pet Health Integration - Litter Box Tracking

## Implementation Complete! ✅

The litter box visit tracking feature has been successfully implemented. Here's what was added:

### New Features

1. **Service: `pet_health.log_litter_box_visit`**
   - Records litter box visits with detailed health tracking
   - Stores data persistently using Home Assistant's storage system
   - Supports multiple poop consistencies in a single visit (perfect for Ziggy's case!)

### Data Fields

- **Visit Type** (required): pee, poop, or both
- **Poop Consistencies** (optional, multiple): normal, soft, diarrhea, hard, constipated
- **Poop Color** (optional): brown, dark_brown, light_brown, bloody, green, yellow, black, unusual
- **Urine Amount** (optional): normal, more_than_usual, less_than_usual (for diabetes monitoring)
- **Notes** (optional): freeform text for additional observations

### File Changes

1. **const.py** - Added enums for visit types, poop consistency/color, urine amount, and service constants
2. **models.py** - Added `LitterBoxVisit` dataclass with serialization methods
3. **store.py** - Implemented persistent storage with `async_save_visit()` and `get_visits()` methods
4. **__init__.py** - Registered service with full validation schema and storage integration
5. **services.yaml** - Created service definition with all field descriptions
6. **strings.json** - Added service translations

### How to Test

#### Method 1: Developer Tools (Easiest!)

1. Open Home Assistant UI in your browser
2. Go to **Developer Tools** → **Services**
3. Select service: `Pet Health: Log litter box visit`
4. Fill in the form:
   - **Pet**: Select one of your cats (Ziggy, etc.)
   - **Visit type**: Choose pee, poop, or both
   - **Poop consistencies**: Select multiple (e.g., "normal" then "diarrhea" for Ziggy)
   - **Poop color**: Optional - select color
   - **Urine amount**: Optional - select "more_than_usual" for diabetes tracking
   - **Notes**: Optional - add any observations
5. Click **Call Service**

#### Method 2: Automation Example

```yaml
service: pet_health.log_litter_box_visit
data:
  config_entry_id: "YOUR_PET_CONFIG_ENTRY_ID"
  visit_type: both
  poop_consistencies:
    - normal
    - diarrhea  # Track consistency changes during same visit
  poop_color: brown
  urine_amount: more_than_usual  # Diabetes monitoring
  notes: "Ziggy seemed uncomfortable"
```

#### Method 3: YAML Service Call

```yaml
service: pet_health.log_litter_box_visit
target:
  config_entry_id: "YOUR_ZIGGY_ENTRY_ID"
data:
  visit_type: "poop"
  poop_consistencies:
    - "normal"
    - "soft"
    - "diarrhea"
  poop_color: "brown"
  notes: "Started normal, progressed to diarrhea"
```

### Storage Location

Visit data is stored in: `/workspaces/core/config/.storage/pet_health_visits`

The data persists across Home Assistant restarts and includes:
- Timestamp (automatically recorded)
- Pet ID (from config entry)
- All visit details
- Visit history for each pet

### Next Steps

Now you can:
1. **Test the service** in Developer Tools
2. **Create automations** to prompt you to log visits
3. **Add sensor platform** (future) to display:
   - Last visit time
   - Daily visit count
   - Recent consistency trends
4. **Add event platform** (future) for timeline integration
5. **Add feeding tracking** using similar pattern
6. **Add weight tracking** for monitoring health trends

### Example: Finding Your Config Entry ID

The easiest way to get your pet's config entry ID for testing:
1. Go to Developer Tools → Services
2. Select `pet_health.log_litter_box_visit`
3. The "Pet" dropdown will show all your configured pets
4. The value shown is the config entry ID

---

**Your specific use cases are now fully supported:**
- ✅ Ziggy's poop consistency changes within one visit (multiple consistencies)
- ✅ Diabetes monitoring with urine amount tracking
- ✅ Detailed color and notes for health tracking
- ✅ Persistent storage of all visit history
