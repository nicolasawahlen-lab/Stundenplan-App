import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import "./App.css";

const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const classes = ["7. Klasse", "8. Klasse", "9. Klasse"];
const times = [
  "7:30 - 8:15",
  "8:20 - 9:05",
  "9:10 - 9:55",
  "10:15 - 11:00",
  "11:05 - 11:50",
  "11:55 - 12:40",
  "12:45 - 13:30",
  "13:40 - 14:25",
  "14:30 - 15:15",
  "15:30 - 16:15",
  "16:20 - 17:05",
];

const subjectAddons = ["TT", "S", "R", "G1", "G2", "G3"];

const emptyFormData = {
  fach: "",
  fachZusatz: "",
  klasse: classes[0],
  lehrpersonen: [""],
  dauer: 1,
};

const getViewFromHash = () => {
  const hash = window.location.hash.replace("#", "");

  if (hash === "/klassen") return "klassen";
  if (hash === "/lehrpersonen") return "lehrpersonen";
  return "main";
};

function App() {
  const [blockData, setBlockData] = useState([]);
  const [paletteBlocks, setPaletteBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [colorMode, setColorMode] = useState("fach");
  const [clipboard, setClipboard] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [compactView, setCompactView] = useState(false);
  const [isPaletteDragOver, setIsPaletteDragOver] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsView, setStatsView] = useState("overview");
  const [currentView, setCurrentView] = useState(getViewFromHash());

  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [editingIsPalette, setEditingIsPalette] = useState(true);
  const [formData, setFormData] = useState(emptyFormData);

  const fileInputRef = useRef(null);

  const normalizeTeacherList = useCallback((value) => {
    if (Array.isArray(value)) {
      const cleaned = value
        .map((entry) => String(entry || "").trim())
        .filter(Boolean);
      return cleaned.length > 0 ? cleaned : [""];
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [""];
    }

    return [""];
  }, []);

  const normalizeSubjectAddon = useCallback((value) => {
    const normalized = String(value || "").trim().toUpperCase();
    return subjectAddons.includes(normalized) ? normalized : "";
  }, []);

  const getTeacherListFromBlock = useCallback(
    (block) => {
      if (Array.isArray(block.lehrpersonen)) {
        return block.lehrpersonen
          .map((entry) => String(entry || "").trim())
          .filter(Boolean);
      }

      if (typeof block.lehrer === "string" && block.lehrer.trim()) {
        return [block.lehrer.trim()];
      }

      return [];
    },
    []
  );

  const getTeacherDisplay = useCallback(
    (block) => {
      const list = getTeacherListFromBlock(block);
      return list.length > 0 ? list.join(", ") : "";
    },
    [getTeacherListFromBlock]
  );

  const getSubjectDisplay = useCallback((block) => {
    const fach = String(block?.fach || "").trim();
    const fachZusatz = String(block?.fachZusatz || "").trim();

    if (!fach) return "";
    if (!fachZusatz) return fach;

    return `${fach} (${fachZusatz.toLowerCase()})`;
  }, []);

  const normalizeBlock = useCallback(
    (b) => {
      const klasse = classes.includes(b.klasse) ? b.klasse : classes[0];
      const lehrpersonen = normalizeTeacherList(
        Array.isArray(b.lehrpersonen) ? b.lehrpersonen : b.lehrer
      );

      return {
        ...b,
        id:
          b.id != null
            ? String(b.id)
            : typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dauer: b.dauer === 2 ? 2 : 1,
        parallelSlot:
          b.parallelSlot === 0 || b.parallelSlot === 1 ? b.parallelSlot : null,
        tag: b.tag ?? null,
        lektion: Number.isInteger(b.lektion) ? b.lektion : null,
        fach: b.fach ?? "",
        fachZusatz: normalizeSubjectAddon(b.fachZusatz),
        klasse,
        lehrpersonen,
      };
    },
    [normalizeTeacherList, normalizeSubjectAddon]
  );

  const createId = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const navigateTo = (view) => {
    if (view === "main") {
      window.location.hash = "/";
      return;
    }

    if (view === "klassen") {
      window.location.hash = "/klassen";
      return;
    }

    if (view === "lehrpersonen") {
      window.location.hash = "/lehrpersonen";
    }
  };

  const exportData = useCallback(() => {
    const data = JSON.stringify({ blockData, paletteBlocks }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const fileName =
      prompt("Dateiname für den Stundenplan:", "stundenplan.json") ||
      "stundenplan.json";

    const safeFileName = fileName.endsWith(".json")
      ? fileName
      : `${fileName}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = safeFileName;
    a.click();

    URL.revokeObjectURL(url);
  }, [blockData, paletteBlocks]);

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        setBlockData((data.blockData || []).map(normalizeBlock));
        setPaletteBlocks(
          (data.paletteBlocks || []).map((b) => ({
            ...normalizeBlock(b),
            tag: null,
            lektion: null,
            parallelSlot: null,
          }))
        );
        setSelectedBlock(null);
      } catch (error) {
        alert("Die Datei konnte nicht importiert werden.");
      }
    };

    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem("stundenplan-data");
      if (!raw) return;

      const data = JSON.parse(raw);
      setBlockData((data.blockData || []).map(normalizeBlock));
      setPaletteBlocks((data.paletteBlocks || []).map(normalizeBlock));
    } catch (error) {
      console.error("Lokale Daten konnten nicht geladen werden.", error);
    }
  }, [normalizeBlock]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "stundenplan-data",
        JSON.stringify({ blockData, paletteBlocks })
      );
    } catch (error) {
      console.error("Lokale Daten konnten nicht gespeichert werden.", error);
    }
  }, [blockData, paletteBlocks]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(getViewFromHash());
      setSelectedBlock(null);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const getBlocksInCell = useCallback(
    (day, klasse, lektion, excludeId = null) => {
      return blockData.filter((b) => {
        if (b.id === excludeId) return false;
        if (b.tag !== day || b.klasse !== klasse) return false;
        if (b.lektion == null) return false;

        const start = b.lektion;
        const end = start + (b.dauer || 1) - 1;
        return lektion >= start && lektion <= end;
      });
    },
    [blockData]
  );

  const getAvailableParallelSlot = useCallback(
    (day, klasse, startLektion, dauer, excludeId = null) => {
      for (let slot = 0; slot <= 1; slot++) {
        let slotFreeEverywhere = true;

        for (let offset = 0; offset < dauer; offset++) {
          const lektion = startLektion + offset;
          const blocksInCell = getBlocksInCell(day, klasse, lektion, excludeId);

          const slotOccupied = blocksInCell.some(
            (b) => (b.parallelSlot ?? 0) === slot
          );

          if (slotOccupied) {
            slotFreeEverywhere = false;
            break;
          }
        }

        if (slotFreeEverywhere) return slot;
      }

      return null;
    },
    [getBlocksInCell]
  );

  const canPlaceBlock = useCallback(
    ({
      blockId = null,
      day,
      klasse,
      startLektion,
      dauer,
      preferredSlot = null,
    }) => {
      if (startLektion < 0 || startLektion + dauer > times.length) {
        return { possible: false, reason: "out-of-range", slot: null };
      }

      if (preferredSlot === 0 || preferredSlot === 1) {
        for (let offset = 0; offset < dauer; offset++) {
          const lektion = startLektion + offset;
          const blocksInCell = getBlocksInCell(day, klasse, lektion, blockId);

          const slotOccupied = blocksInCell.some(
            (b) => (b.parallelSlot ?? 0) === preferredSlot
          );

          if (slotOccupied) {
            return { possible: false, reason: "slot-occupied", slot: null };
          }
        }

        return { possible: true, reason: null, slot: preferredSlot };
      }

      const freeSlot = getAvailableParallelSlot(
        day,
        klasse,
        startLektion,
        dauer,
        blockId
      );

      if (freeSlot === null) {
        return { possible: false, reason: "no-slot", slot: null };
      }

      return { possible: true, reason: null, slot: freeSlot };
    },
    [getBlocksInCell, getAvailableParallelSlot]
  );

  const allBlocks = useMemo(() => {
    return [...blockData, ...paletteBlocks];
  }, [blockData, paletteBlocks]);

  const teachers = useMemo(() => {
    return [
      ...new Set(
        blockData.flatMap((b) => getTeacherListFromBlock(b)).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "de"));
  }, [blockData, getTeacherListFromBlock]);

  const distinctColorMap = useMemo(() => {
    const sourceValues = allBlocks
      .map((b) => {
        if (colorMode === "fach") return b.fach;
        const teacherList = getTeacherListFromBlock(b);
        return teacherList.length > 0 ? teacherList.join(", ") : "Unbekannt";
      })
      .map((value) => String(value || "Unbekannt").trim())
      .filter(Boolean);

    const uniqueValues = [...new Set(sourceValues)].sort((a, b) =>
      a.localeCompare(b, "de")
    );

    const map = {};
    const lightnessPattern = [52, 60, 46, 56];
    const saturationPattern = [72, 68, 78, 64];

    uniqueValues.forEach((value, index) => {
      const hue = Math.round((index * 137.508) % 360);
      const lightness = lightnessPattern[index % lightnessPattern.length];
      const saturation = saturationPattern[index % saturationPattern.length];
      map[value] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    });

    if (!map.Unbekannt) {
      map.Unbekannt = "hsl(0, 0%, 55%)";
    }

    return map;
  }, [allBlocks, colorMode, getTeacherListFromBlock]);

  const getColor = useCallback(
    (block) => {
      const key =
        colorMode === "fach"
          ? String(block.fach || "Unbekannt").trim()
          : (() => {
              const teacherList = getTeacherListFromBlock(block);
              return teacherList.length > 0
                ? teacherList.join(", ")
                : "Unbekannt";
            })();

      return distinctColorMap[key] || distinctColorMap.Unbekannt;
    },
    [colorMode, distinctColorMap, getTeacherListFromBlock]
  );

  const hasTeacherOverlap = useCallback(
    (block) => {
      const teacherList = getTeacherListFromBlock(block);

      if (teacherList.length === 0 || block.tag == null || block.lektion == null) {
        return false;
      }

      const blockStart = block.lektion;
      const blockEnd = blockStart + (block.dauer || 1) - 1;

      return blockData.some((other) => {
        if (other.id === block.id) return false;
        if (other.tag !== block.tag) return false;
        if (other.lektion == null) return false;

        const otherTeachers = getTeacherListFromBlock(other);
        if (otherTeachers.length === 0) return false;

        const sharesTeacher = teacherList.some((t) => otherTeachers.includes(t));
        if (!sharesTeacher) return false;

        const otherStart = other.lektion;
        const otherEnd = otherStart + (other.dauer || 1) - 1;

        return !(blockEnd < otherStart || blockStart > otherEnd);
      });
    },
    [blockData, getTeacherListFromBlock]
  );

  const teacherConflicts = useMemo(() => {
    const conflicts = [];
    const seen = new Set();

    blockData.forEach((block) => {
      const teacherList = getTeacherListFromBlock(block);

      if (teacherList.length === 0 || block.tag == null || block.lektion == null) {
        return;
      }

      const blockStart = block.lektion;
      const blockEnd = blockStart + (block.dauer || 1) - 1;

      teacherList.forEach((teacher) => {
        const overlappingBlocks = blockData.filter((other) => {
          if (other.id === block.id) return false;
          if (other.tag !== block.tag) return false;
          if (other.lektion == null) return false;

          const otherTeachers = getTeacherListFromBlock(other);
          if (!otherTeachers.includes(teacher)) return false;

          const otherStart = other.lektion;
          const otherEnd = otherStart + (other.dauer || 1) - 1;

          return !(blockEnd < otherStart || blockStart > otherEnd);
        });

        if (overlappingBlocks.length > 0) {
          const visualKey = `${teacher}-${block.tag}-${block.lektion}-${block.id}`;

          if (!seen.has(visualKey)) {
            seen.add(visualKey);
            conflicts.push({
              key: visualKey,
              lehrer: teacher,
              tag: block.tag,
              zeit: times[block.lektion] || `Lektion ${block.lektion + 1}`,
              klasse: block.klasse || "Ohne Klasse",
              fach: getSubjectDisplay(block) || "Ohne Fach",
            });
          }
        }
      });
    });

    return conflicts.sort((a, b) => {
      const dayCompare = days.indexOf(a.tag) - days.indexOf(b.tag);
      if (dayCompare !== 0) return dayCompare;

      const timeCompare =
        times.indexOf(a.zeit) >= 0 && times.indexOf(b.zeit) >= 0
          ? times.indexOf(a.zeit) - times.indexOf(b.zeit)
          : a.zeit.localeCompare(b.zeit, "de");

      if (timeCompare !== 0) return timeCompare;

      return a.lehrer.localeCompare(b.lehrer, "de");
    });
  }, [blockData, getTeacherListFromBlock, getSubjectDisplay]);

  const openCreateModal = () => {
    setFormMode("create");
    setEditingBlockId(null);
    setEditingIsPalette(true);
    setFormData({
      fach: "",
      fachZusatz: "",
      klasse: classes[0],
      lehrpersonen: [""],
      dauer: 1,
    });
    setShowFormModal(true);
  };

  const openEditModal = (block, isPalette) => {
    const existingTeachers = getTeacherListFromBlock(block);

    setFormMode("edit");
    setEditingBlockId(block.id);
    setEditingIsPalette(isPalette);
    setFormData({
      fach: block.fach || "",
      fachZusatz: block.fachZusatz || "",
      klasse: classes.includes(block.klasse) ? block.klasse : classes[0],
      lehrpersonen: existingTeachers.length > 0 ? existingTeachers : [""],
      dauer: block.dauer === 2 ? 2 : 1,
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingBlockId(null);
    setEditingIsPalette(true);
    setFormData(emptyFormData);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]:
        field === "dauer"
          ? Number(value)
          : field === "fachZusatz"
          ? String(value || "").toUpperCase()
          : value,
    }));
  };

  const handleTeacherChange = (index, value) => {
    setFormData((prev) => ({
      ...prev,
      lehrpersonen: prev.lehrpersonen.map((entry, i) =>
        i === index ? value : entry
      ),
    }));
  };

  const addTeacherField = () => {
    setFormData((prev) => ({
      ...prev,
      lehrpersonen: [...prev.lehrpersonen, ""],
    }));
  };

  const removeTeacherField = (index) => {
    setFormData((prev) => {
      const next = prev.lehrpersonen.filter((_, i) => i !== index);
      return {
        ...prev,
        lehrpersonen: next.length > 0 ? next : [""],
      };
    });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();

    const fach = formData.fach.trim();
    const fachZusatz = normalizeSubjectAddon(formData.fachZusatz);
    const klasse = formData.klasse;
    const lehrpersonen = formData.lehrpersonen
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
    const dauer = Number(formData.dauer) === 2 ? 2 : 1;

    if (!fach) {
      alert("Bitte ein Fach eingeben.");
      return;
    }

    if (!klasse) {
      alert("Bitte eine Klasse auswählen.");
      return;
    }

    if (lehrpersonen.length === 0) {
      alert("Bitte mindestens eine Lehrperson eingeben.");
      return;
    }

    if (formMode === "create") {
      setPaletteBlocks((prev) => [
        ...prev,
        {
          id: createId(),
          fach,
          fachZusatz,
          klasse,
          lehrpersonen,
          dauer,
          tag: null,
          lektion: null,
          parallelSlot: null,
        },
      ]);
      closeFormModal();
      return;
    }

    const scheduledBlock = blockData.find((b) => b.id === editingBlockId);
    const paletteBlock = paletteBlocks.find((b) => b.id === editingBlockId);
    const currentBlock = scheduledBlock || paletteBlock;

    if (!currentBlock) {
      closeFormModal();
      return;
    }

    if (
      !editingIsPalette &&
      currentBlock.tag !== null &&
      currentBlock.lektion !== null
    ) {
      if (klasse !== currentBlock.klasse) {
        alert(
          "Die Klasse eines bereits gesetzten Blocks kann nicht geändert werden. Verschiebe den Block zuerst zurück in die Palette oder lösche ihn und lege ihn neu an."
        );
        return;
      }

      const slotStillFits = canPlaceBlock({
        blockId: currentBlock.id,
        day: currentBlock.tag,
        klasse,
        startLektion: currentBlock.lektion,
        dauer,
        preferredSlot: currentBlock.parallelSlot ?? 0,
      });

      if (!slotStillFits.possible) {
        alert(
          "Die neue Dauer passt am aktuellen Ort nicht. Bitte verschiebe den Block zuerst oder wähle Dauer 1."
        );
        return;
      }

      setBlockData((prev) =>
        prev.map((x) =>
          x.id === currentBlock.id
            ? {
                ...x,
                fach,
                fachZusatz,
                klasse,
                lehrpersonen,
                dauer,
                parallelSlot: slotStillFits.slot,
              }
            : x
        )
      );
      closeFormModal();
      return;
    }

    if (editingIsPalette) {
      setPaletteBlocks((prev) =>
        prev.map((x) =>
          x.id === currentBlock.id
            ? { ...x, fach, fachZusatz, klasse, lehrpersonen, dauer }
            : x
        )
      );
    } else {
      setBlockData((prev) =>
        prev.map((x) =>
          x.id === currentBlock.id
            ? { ...x, fach, fachZusatz, klasse, lehrpersonen, dauer }
            : x
        )
      );
    }

    closeFormModal();
  };

  const handleDropToCell = (e, day, klasse, rowIndex) => {
    e.preventDefault();

    const id = e.dataTransfer.getData("id");
    if (!id) return;

    const fromPalette = paletteBlocks.find((b) => b.id === id);
    const movingBlock = blockData.find((b) => b.id === id);
    const block = fromPalette || movingBlock;

    if (!block) return;

    if (block.klasse !== klasse) {
      alert(
        `Dieser Block gehört zur ${block.klasse} und kann nur in dieser Klassen-Spalte gesetzt werden.`
      );
      return;
    }

    const dauer = block.dauer || 1;

    const placement = canPlaceBlock({
      blockId: movingBlock ? id : null,
      day,
      klasse,
      startLektion: rowIndex,
      dauer,
    });

    if (!placement.possible) {
      if (placement.reason === "out-of-range") {
        alert("Die Doppelstunde passt hier nicht mehr nach unten.");
      } else {
        alert(
          "Hier ist kein passender Parallel-Slot frei. Für eine Doppelstunde muss derselbe Slot in allen benötigten Lektionen frei sein."
        );
      }
      return;
    }

    if (fromPalette) {
      setPaletteBlocks((prev) => prev.filter((b) => b.id !== id));
      setBlockData((prev) => [
        ...prev,
        {
          ...block,
          tag: day,
          klasse,
          lektion: rowIndex,
          parallelSlot: placement.slot,
        },
      ]);
    } else {
      setBlockData((prev) =>
        prev.map((b) =>
          b.id === id
            ? {
                ...b,
                tag: day,
                klasse,
                lektion: rowIndex,
                parallelSlot: placement.slot,
              }
            : b
        )
      );
    }
  };

  const handleDropToPalette = (e) => {
    e.preventDefault();
    setIsPaletteDragOver(false);

    const id = e.dataTransfer.getData("id");
    if (!id) return;

    const scheduledBlock = blockData.find((b) => b.id === id);
    if (!scheduledBlock) return;

    const paletteVersion = {
      ...scheduledBlock,
      tag: null,
      lektion: null,
      parallelSlot: null,
    };

    setBlockData((prev) => prev.filter((b) => b.id !== id));
    setPaletteBlocks((prev) => {
      const alreadyExists = prev.some((b) => b.id === id);
      return alreadyExists ? prev : [...prev, paletteVersion];
    });
    setSelectedBlock(id);
  };

  const statsByClassAndSubject = useMemo(() => {
    const map = {};

    for (const klasse of classes) {
      map[klasse] = {};
    }

    blockData.forEach((block) => {
      const klasse = block.klasse || "Ohne Klasse";
      const fach = getSubjectDisplay(block) || "Ohne Fach";
      const count = block.dauer || 1;

      if (!map[klasse]) {
        map[klasse] = {};
      }

      if (!map[klasse][fach]) {
        map[klasse][fach] = 0;
      }

      map[klasse][fach] += count;
    });

    return map;
  }, [blockData, getSubjectDisplay]);

  const statsByTeacher = useMemo(() => {
    const map = {};

    blockData.forEach((block) => {
      const teacherList = getTeacherListFromBlock(block);
      const count = block.dauer || 1;

      if (teacherList.length === 0) {
        if (!map["Ohne Lehrperson"]) {
          map["Ohne Lehrperson"] = 0;
        }
        map["Ohne Lehrperson"] += count;
        return;
      }

      teacherList.forEach((teacher) => {
        if (!map[teacher]) {
          map[teacher] = 0;
        }
        map[teacher] += count;
      });
    });

    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], "de"));
  }, [blockData, getTeacherListFromBlock]);

  const totalLessons = useMemo(() => {
    return blockData.reduce((sum, block) => sum + (block.dauer || 1), 0);
  }, [blockData]);

  const totalScheduledBlocks = blockData.length;

  const renderBlocksInCell = (day, klasse, rowIndex) => {
    const blocksStartingHere = blockData
      .filter(
        (b) => b.tag === day && b.klasse === klasse && b.lektion === rowIndex
      )
      .sort((a, b) => (a.parallelSlot ?? 0) - (b.parallelSlot ?? 0));

    const isSingleBlock = blocksStartingHere.length === 1;

    return blocksStartingHere.map((b) => {
      const slot = b.parallelSlot ?? 0;
      const dauer = b.dauer || 1;
      const teacherOverlap = hasTeacherOverlap(b);

      return (
        <div
          key={b.id}
          className={`block scheduled-block ${
            selectedBlock === b.id ? "selected" : ""
          } ${teacherOverlap ? "teacher-overlap" : ""}`}
          style={{
            backgroundColor: getColor(b),
            left: isSingleBlock ? "0%" : slot === 0 ? "0%" : "50%",
            width: isSingleBlock ? "100%" : "50%",
            height: `calc(${dauer} * var(--cell-height) + ${
              dauer - 1
            } * var(--grid-gap))`,
            zIndex: teacherOverlap ? 20 : 10,
          }}
          title={
            teacherOverlap
              ? `Achtung: ${getTeacherDisplay(
                  b
                )} ist am ${b.tag} parallel eingeplant.`
              : `${getSubjectDisplay(b)} – ${b.klasse} – ${getTeacherDisplay(b)}`
          }
          draggable
          onClick={() => setSelectedBlock(b.id)}
          onDoubleClick={() => openEditModal(b, false)}
          onDragStart={(e) => e.dataTransfer.setData("id", b.id)}
        >
          <div className="fach">
            {b.fach}
            {b.fachZusatz && (
              <span className="fach-zusatz">({b.fachZusatz.toLowerCase()})</span>
            )}
          </div>
          <div className="klasse">{b.klasse}</div>
          <div className="lehrer">{getTeacherDisplay(b)}</div>
          {dauer === 2 && <div className="dauer-label">Doppelstunde</div>}
          {teacherOverlap && <div className="conflict-badge">!</div>}
        </div>
      );
    });
  };

  const renderReadOnlySchedule = (title, blocks, subtitle = null) => {
    const renderReadOnlyBlocksInCell = (day, rowIndex) => {
      const blocksStartingHere = blocks
        .filter((b) => b.tag === day && b.lektion === rowIndex)
        .sort((a, b) => (a.parallelSlot ?? 0) - (b.parallelSlot ?? 0));

      const isSingleBlock = blocksStartingHere.length === 1;

      return blocksStartingHere.map((b) => {
        const slot = b.parallelSlot ?? 0;
        const dauer = b.dauer || 1;
        const teacherOverlap = hasTeacherOverlap(b);

        return (
          <div
            key={b.id}
            className={`block scheduled-block read-only-block ${
              teacherOverlap ? "teacher-overlap" : ""
            }`}
            style={{
              backgroundColor: getColor(b),
              left: isSingleBlock ? "0%" : slot === 0 ? "0%" : "50%",
              width: isSingleBlock ? "100%" : "50%",
              height: `calc(${dauer} * var(--cell-height) + ${
                dauer - 1
              } * var(--grid-gap))`,
              zIndex: teacherOverlap ? 20 : 10,
              cursor: "default",
            }}
            title={`${getSubjectDisplay(b)} – ${b.klasse} – ${getTeacherDisplay(b)}`}
          >
            <div className="fach">
              {b.fach}
              {b.fachZusatz && (
                <span className="fach-zusatz">({b.fachZusatz.toLowerCase()})</span>
              )}
            </div>
            <div className="klasse">{b.klasse}</div>
            <div className="lehrer">{getTeacherDisplay(b)}</div>
            {dauer === 2 && <div className="dauer-label">Doppelstunde</div>}
            {teacherOverlap && <div className="conflict-badge">!</div>}
          </div>
        );
      });
    };

    return (
      <div className="single-schedule-print-block" key={title}>
        <h2>{title}</h2>
        {subtitle && <div className="summary-subtitle">{subtitle}</div>}

        <div className="single-plan-wrapper">
          <div className="single-grid">
            <div className="time header-cell">Zeit</div>

            {days.map((d) => (
              <div key={d} className="day-header">
                {d}
              </div>
            ))}

            {times.map((t, rowIndex) => (
              <React.Fragment key={`${title}-${rowIndex}`}>
                <div className="time">{t}</div>

                {days.map((d) => (
                  <div
                    key={`${title}-${d}-${rowIndex}`}
                    className="cell read-only-cell"
                    style={{
                      backgroundColor:
                        rowIndex === 5 || rowIndex === 6 ? "#eee" : "",
                    }}
                  >
                    {renderReadOnlyBlocksInCell(d, rowIndex)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 1.8));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const zoomReset = () => setZoom(1);

  const setOverview = () => {
    setCompactView(true);
    setZoom(0.7);
  };

  const setNormalView = () => {
    setCompactView(false);
    setZoom(1);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.includes("Mac");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      const tagName = document.activeElement?.tagName?.toLowerCase();
      const isTyping =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        document.activeElement?.isContentEditable;

      if (ctrl && e.key === "s") {
        e.preventDefault();
        exportData();
      }

      if (ctrl && e.key === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      }

      if (ctrl && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }

      if (
        !isTyping &&
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedBlock &&
        currentView === "main"
      ) {
        setBlockData((prev) => prev.filter((b) => b.id !== selectedBlock));
        setPaletteBlocks((prev) => prev.filter((b) => b.id !== selectedBlock));
        setSelectedBlock(null);
      }

      if (ctrl && e.key === "c" && selectedBlock && currentView === "main") {
        const b =
          blockData.find((x) => x.id === selectedBlock) ||
          paletteBlocks.find((x) => x.id === selectedBlock);

        if (b) setClipboard(b);
      }

      if (ctrl && e.key === "v" && clipboard && currentView === "main") {
        setPaletteBlocks((prev) => [
          ...prev,
          {
            ...clipboard,
            id: createId(),
            tag: null,
            lektion: null,
            parallelSlot: null,
          },
        ]);
      }

      if (ctrl && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setZoom((prev) => Math.min(prev + 0.1, 1.8));
      }

      if (ctrl && e.key === "-") {
        e.preventDefault();
        setZoom((prev) => Math.max(prev - 0.1, 0.5));
      }

      if (ctrl && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }

      if (ctrl && e.key.toLowerCase() === "i" && currentView === "main") {
        e.preventDefault();
        setShowStats((prev) => !prev);
      }

      if (e.key === "Escape" && showFormModal) {
        closeFormModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedBlock,
    clipboard,
    blockData,
    paletteBlocks,
    exportData,
    showFormModal,
    currentView,
  ]);

  const cellWidth = compactView ? 78 * zoom : 100 * zoom;
  const cellHeight = compactView ? 46 * zoom : 60 * zoom;
  const fontScale = compactView ? 0.9 : 1;

  const sharedStyleVars = {
    "--cell-width": `${cellWidth}px`,
    "--cell-height": `${cellHeight}px`,
    "--grid-gap": compactView ? "3px" : "4px",
    "--font-scale": fontScale,
    "--time-col-width": "120px",
  };

  const renderClassSchedulesPage = () => {
    return (
      <div className="summary-page">
        <div className="toolbar no-print">
          <button onClick={() => navigateTo("main")}>← Zur Hauptseite</button>
          <button onClick={() => navigateTo("lehrpersonen")}>
            Zur LP-Ansicht
          </button>
          <button onClick={handlePrint}>Drucken</button>
        </div>

        <h1>Stundenpläne nach Klassen</h1>

        {classes.map((klasse) => {
          const classBlocks = blockData.filter((b) => b.klasse === klasse);
          return renderReadOnlySchedule(
            klasse,
            classBlocks,
            "Nur Ansicht – Änderungen bitte auf der Hauptseite vornehmen."
          );
        })}
      </div>
    );
  };

  const renderTeacherSchedulesPage = () => {
    return (
      <div className="summary-page">
        <div className="toolbar no-print">
          <button onClick={() => navigateTo("main")}>← Zur Hauptseite</button>
          <button onClick={() => navigateTo("klassen")}>
            Zur Klassen-Ansicht
          </button>
          <button onClick={handlePrint}>Drucken</button>
        </div>

        <h1>Stundenpläne nach Lehrpersonen</h1>

        {teachers.length === 0 ? (
          <p>Es sind noch keine Lehrpersonen im Stundenplan eingetragen.</p>
        ) : (
          teachers.map((lehrer) => {
            const teacherBlocks = blockData.filter((b) =>
              getTeacherListFromBlock(b).includes(lehrer)
            );

            return renderReadOnlySchedule(
              lehrer,
              teacherBlocks,
              "Nur Ansicht – Änderungen bitte auf der Hauptseite vornehmen."
            );
          })
        )}
      </div>
    );
  };

  if (currentView === "klassen") {
    return (
      <div className="App summary-view" style={sharedStyleVars}>
        {renderClassSchedulesPage()}
      </div>
    );
  }

  if (currentView === "lehrpersonen") {
    return (
      <div className="App summary-view" style={sharedStyleVars}>
        {renderTeacherSchedulesPage()}
      </div>
    );
  }

  return (
    <div className="App" style={sharedStyleVars}>
      <h1>Stundenplan</h1>

      <div className="toolbar no-print">
        <button
          onClick={() =>
            setColorMode((prev) => (prev === "fach" ? "lehrer" : "fach"))
          }
        >
          Farbmodus: {colorMode === "fach" ? "Fach" : "Lehrperson"}
        </button>

        <button onClick={openCreateModal}>+ Block erstellen</button>
        <button onClick={() => setShowStats((prev) => !prev)}>
          {showStats ? "Statistik ausblenden" : "Statistik anzeigen"}
        </button>
        <button onClick={() => navigateTo("klassen")}>Klassenpläne</button>
        <button onClick={() => navigateTo("lehrpersonen")}>LP-Pläne</button>
        <button onClick={exportData}>Speichern / Exportieren</button>
        <button onClick={() => fileInputRef.current?.click()}>
          Importieren
        </button>
        <button onClick={handlePrint}>Drucken</button>
      </div>

      <div className="toolbar no-print">
        <button onClick={zoomOut}>Zoom -</button>
        <button onClick={zoomIn}>Zoom +</button>
        <button onClick={zoomReset}>Zoom 100%</button>
        <button onClick={setOverview}>Gesamtansicht</button>
        <button onClick={setNormalView}>Normalansicht</button>
        <span className="zoom-info">Zoom: {Math.round(zoom * 100)}%</span>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={importData}
      />

      {showStats && (
        <div className="stats-panel no-print">
          <div className="stats-header">
            <h2>Statistik</h2>
            <button onClick={() => setShowStats(false)}>Schliessen</button>
          </div>

          <div className="stats-tabs">
            <button
              className={
                statsView === "overview" ? "tab-button active" : "tab-button"
              }
              onClick={() => setStatsView("overview")}
            >
              Übersicht
            </button>
            <button
              className={
                statsView === "classSubject"
                  ? "tab-button active"
                  : "tab-button"
              }
              onClick={() => setStatsView("classSubject")}
            >
              nach Klasse + Fach
            </button>
            <button
              className={
                statsView === "teacher" ? "tab-button active" : "tab-button"
              }
              onClick={() => setStatsView("teacher")}
            >
              nach Lehrperson
            </button>
          </div>

          {statsView === "overview" && (
            <>
              <div className="stats-summary">
                <div className="stats-card">
                  <div className="stats-number">{totalScheduledBlocks}</div>
                  <div className="stats-label">gesetzte Blöcke</div>
                </div>
                <div className="stats-card">
                  <div className="stats-number">{totalLessons}</div>
                  <div className="stats-label">geplante Lektionen</div>
                </div>
                <div className="stats-card warning-card">
                  <div className="stats-number">{teacherConflicts.length}</div>
                  <div className="stats-label">
                    LP-Hinweise / Überschneidungen
                  </div>
                </div>
              </div>

              <div className="conflict-list">
                <h3>Lehrpersonen-Hinweise</h3>
                {teacherConflicts.length === 0 ? (
                  <div className="muted-cell">
                    Keine markierten Überschneidungen.
                  </div>
                ) : (
                  <ul>
                    {teacherConflicts.map((entry, index) => (
                      <li key={`${entry.key}-${index}`}>
                        <strong>{entry.lehrer}</strong>: {entry.tag}, {entry.zeit},{" "}
                        {entry.klasse}, {entry.fach}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {statsView === "classSubject" && (
            <div className="stats-table-wrapper">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Klasse</th>
                    <th>Fach</th>
                    <th>Lektionen</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(statsByClassAndSubject).flatMap(
                    ([klasse, subjects]) => {
                      const subjectEntries = Object.entries(subjects).sort(
                        (a, b) => a[0].localeCompare(b[0], "de")
                      );

                      if (subjectEntries.length === 0) {
                        return [
                          <tr key={`${klasse}-empty`}>
                            <td>{klasse}</td>
                            <td className="muted-cell">–</td>
                            <td className="muted-cell">0</td>
                          </tr>,
                        ];
                      }

                      return subjectEntries.map(([fach, count]) => (
                        <tr key={`${klasse}-${fach}`}>
                          <td>{klasse}</td>
                          <td>{fach}</td>
                          <td>{count}</td>
                        </tr>
                      ));
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          {statsView === "teacher" && (
            <div className="stats-table-wrapper">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Lehrperson</th>
                    <th>Lektionen</th>
                  </tr>
                </thead>
                <tbody>
                  {statsByTeacher.length === 0 ? (
                    <tr>
                      <td className="muted-cell">–</td>
                      <td className="muted-cell">0</td>
                    </tr>
                  ) : (
                    statsByTeacher.map(([lehrer, count]) => (
                      <tr key={lehrer}>
                        <td>{lehrer}</td>
                        <td>{count}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="plan-wrapper">
        <div className="grid">
          <div></div>

          {days.map((d) => (
            <div
              key={d}
              className="day-header"
              style={{ gridColumn: "span 3" }}
            >
              {d}
            </div>
          ))}

          <div></div>

          {days.map((d) =>
            classes.map((c) => (
              <div key={d + c} className="class-header">
                {c}
              </div>
            ))
          )}

          {times.map((t, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <div className="time">{t}</div>

              {days.map((d) =>
                classes.map((c) => (
                  <div
                    key={d + c + rowIndex}
                    className="cell"
                    style={{
                      backgroundColor:
                        rowIndex === 5 || rowIndex === 6 ? "#eee" : "",
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropToCell(e, d, c, rowIndex)}
                  >
                    {renderBlocksInCell(d, c, rowIndex)}
                  </div>
                ))
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="palette-section no-print">
        <h2>Block-Palette</h2>
        <div
          className={`palette-big ${
            isPaletteDragOver ? "palette-drop-active" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsPaletteDragOver(true);
          }}
          onDragLeave={() => setIsPaletteDragOver(false)}
          onDrop={handleDropToPalette}
        >
          {paletteBlocks.map((b) => (
            <div
              key={b.id}
              className={`block palette-block ${
                selectedBlock === b.id ? "selected" : ""
              }`}
              style={{ backgroundColor: getColor(b) }}
              draggable
              onClick={() => setSelectedBlock(b.id)}
              onDoubleClick={() => openEditModal(b, true)}
              onDragStart={(e) => e.dataTransfer.setData("id", b.id)}
              title={`${getSubjectDisplay(b)} – ${b.klasse} – ${getTeacherDisplay(b)}`}
            >
              <div className="fach">
                {b.fach}
                {b.fachZusatz && (
                  <span className="fach-zusatz">({b.fachZusatz.toLowerCase()})</span>
                )}
              </div>
              <div className="klasse">{b.klasse}</div>
              <div className="lehrer">{getTeacherDisplay(b)}</div>
              {b.dauer === 2 && (
                <div className="dauer-label">Doppelstunde</div>
              )}
            </div>
          ))}
        </div>
        <div className="palette-hint no-print">
          Ziehe Blöcke aus dem Stundenplan zurück in die Palette, um sie wieder
          als Vorratsblock abzulegen.
        </div>
      </div>

      {showFormModal && (
        <div className="modal-overlay no-print" onClick={closeFormModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {formMode === "create"
                  ? "Block erstellen"
                  : "Block bearbeiten"}
              </h2>
              <button className="modal-close-button" onClick={closeFormModal}>
                ×
              </button>
            </div>

            <form className="block-form" onSubmit={handleFormSubmit}>
              <label className="form-field">
                <span>Fach</span>
                <input
                  type="text"
                  value={formData.fach}
                  onChange={(e) => handleFormChange("fach", e.target.value)}
                  placeholder="z. B. Mathematik"
                />
              </label>

              <label className="form-field">
                <span>Zusatz</span>
                <select
                  value={formData.fachZusatz}
                  onChange={(e) =>
                    handleFormChange("fachZusatz", e.target.value)
                  }
                >
                  <option value="">kein Zusatz</option>
                  {subjectAddons.map((addon) => (
                    <option key={addon} value={addon}>
                      ({addon.toLowerCase()})
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Klasse</span>
                <select
                  value={formData.klasse}
                  onChange={(e) => handleFormChange("klasse", e.target.value)}
                  disabled={
                    formMode === "edit" &&
                    !editingIsPalette &&
                    blockData.some((b) => b.id === editingBlockId)
                  }
                >
                  {classes.map((klasse) => (
                    <option key={klasse} value={klasse}>
                      {klasse}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-field">
                <span>Lehrpersonen</span>

                <div className="teacher-fields">
                  {formData.lehrpersonen.map((teacher, index) => (
                    <div key={index} className="teacher-row">
                      <input
                        type="text"
                        value={teacher}
                        onChange={(e) =>
                          handleTeacherChange(index, e.target.value)
                        }
                        placeholder={
                          index === 0
                            ? "z. B. Herr Meier"
                            : "weitere Lehrperson"
                        }
                      />

                      <div className="teacher-row-actions">
                        {formData.lehrpersonen.length > 1 && (
                          <button
                            type="button"
                            className="small-button"
                            onClick={() => removeTeacherField(index)}
                          >
                            −
                          </button>
                        )}

                        {index === formData.lehrpersonen.length - 1 && (
                          <button
                            type="button"
                            className="small-button"
                            onClick={addTeacherField}
                          >
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label className="form-field">
                <span>Dauer</span>
                <select
                  value={formData.dauer}
                  onChange={(e) => handleFormChange("dauer", e.target.value)}
                >
                  <option value={1}>1 Lektion</option>
                  <option value={2}>2 Lektionen (Doppelstunde)</option>
                </select>
              </label>

              {formMode === "edit" &&
                !editingIsPalette &&
                blockData.some((b) => b.id === editingBlockId) && (
                  <div className="form-hint">
                    Die Klasse eines bereits gesetzten Blocks kann hier nicht
                    geändert werden.
                  </div>
                )}

              <div className="modal-actions">
                <button type="button" onClick={closeFormModal}>
                  Abbrechen
                </button>
                <button type="submit">
                  {formMode === "create" ? "Erstellen" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;