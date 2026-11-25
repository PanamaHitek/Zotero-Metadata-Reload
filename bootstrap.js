const FTL_FILE = "metadata-reload.ftl";
const localFields = new Set(["DOI", "accessDate", "archive", "archiveLocation", "callNumber", "extra", "libraryCatalog"]);
const pendingItems = new Set();
let registeredMenuID;

// Zotero registers the Fluent file automatically, but each window
// still needs a <link rel="localization"> to it, or the menu label is blank.
function addLocalization(window) {
  window.MozXULElement.insertFTLIfNeeded(FTL_FILE);
}

function removeLocalization(window) {
  window.document.querySelector(`link[rel="localization"][href="${FTL_FILE}"]`)?.remove();
}

function install() {}

function uninstall() {}

function canRefresh(item) {
  return item?.id && item.isRegularItem() && !item.deleted && item.isEditable();
}

function cleanDOI(value) {
  return typeof value === "string" ? Zotero.Utilities.cleanDOI(value) || "" : "";
}

function getItemDOI(item) {
  return cleanDOI(item.getField("DOI")) || cleanDOI(item.getExtraField("DOI"));
}

function getAvailableDOI(item) {
  return canRefresh(item) && !pendingItems.has(item.id) ? getItemDOI(item) : "";
}

function stillMatchesDOI(item, doi) {
  return canRefresh(item) && getItemDOI(item).toLowerCase() === doi.toLowerCase();
}

async function lookupDOI(doi) {
  const search = new Zotero.Translate.Search();
  search.setIdentifier({ DOI: doi });
  const translators = await search.getTranslators();
  if (!translators.length) {
    return null;
  }

  search.setTranslator(translators);
  const results = await search.translate({ libraryID: false, saveAttachments: false });
  const normalizedDOI = doi.toLowerCase();
  const matchingItem = results.find(result => cleanDOI(result.DOI).toLowerCase() === normalizedDOI);
  if (matchingItem) {
    return matchingItem;
  }
  return results.length === 1 && !cleanDOI(results[0].DOI) ? results[0] : null;
}

async function updateItemMetadata(item, metadata) {
  const sourceType = Zotero.ItemTypes.getID(metadata.itemType);
  if (!sourceType) {
    throw new Error("The DOI lookup returned an unknown Zotero item type.");
  }

  // Validate and normalize the incoming metadata before changing the saved item.
  const draft = new Zotero.Item(item.itemType);
  const fields = Zotero.ItemFields;
  for (const [name, value] of Object.entries(metadata)) {
    const field = fields.getID(name);
    if (!field || localFields.has(name) || (typeof value !== "string" && typeof value !== "number") || !String(value).trim()) {
      continue;
    }
    const baseField = fields.getBaseIDFromTypeAndField(sourceType, field) || field;
    const targetField = fields.isValidForType(field, item.itemTypeID)
      ? field
      : fields.getFieldIDFromTypeAndBase(item.itemTypeID, baseField);
    if (targetField) {
      draft.setField(targetField, value);
    }
  }
  if (metadata.creators?.length) {
    draft.setCreators(metadata.creators);
  }

  const creators = draft.getCreators();
  const currentCreators = item.getCreators();
  const updateCreators = creators.length && (
    creators.length !== currentCreators.length ||
    creators.some((creator, index) => !Zotero.Creators.equals(creator, currentCreators[index]))
  );

  let changed = false;
  for (const field of draft.getUsedFields()) {
    const value = draft.getField(field, true);
    if (value && item.setField(field, value)) {
      changed = true;
    }
  }
  if (updateCreators) {
    item.setCreators(creators);
    changed = true;
  }
  if (changed) {
    await item.saveTx();
  }
  return changed;
}

async function refreshByDOI(item, doi) {
  const staleItem = {
    outcome: "skipped",
    message: "The item or its DOI changed during the refresh. Run the command again to refresh it."
  };
  try {
    if (!stillMatchesDOI(item, doi)) {
      return staleItem;
    }
    const metadata = await lookupDOI(doi);
    if (!metadata) {
      return { outcome: "failed", message: `Zotero found no matching metadata for DOI ${doi}.` };
    }
    if (!stillMatchesDOI(item, doi)) {
      return staleItem;
    }

    const changed = await updateItemMetadata(item, metadata);
    return changed
      ? { outcome: "updated", message: "Updated the selected item." }
      : { outcome: "unchanged", message: "The selected item already has the retrieved metadata." };
  } catch (error) {
    Zotero.logError(error);
    return { outcome: "failed", message: `Could not refresh metadata for DOI ${doi}.` };
  }
}

async function refreshSelection(window, items) {
  const targets = new Map();
  for (const item of items) {
    const doi = getAvailableDOI(item);
    if (doi) {
      targets.set(item.id, { item, doi });
    }
  }
  if (!targets.size) {
    return;
  }

  for (const id of targets.keys()) {
    pendingItems.add(id);
  }
  const selectedCount = items.length;
  const counts = { updated: 0, unchanged: 0, skipped: selectedCount - targets.size, failed: 0 };
  let message;
  try {
    for (const { item, doi } of targets.values()) {
      const result = await refreshByDOI(item, doi);
      counts[result.outcome]++;
      message = result.message;
    }
  } finally {
    for (const id of targets.keys()) {
      pendingItems.delete(id);
    }
  }
  if (selectedCount > 1) {
    message = `${counts.updated} updated, ${counts.unchanged} already current, ${counts.skipped} skipped, ${counts.failed} failed.`;
  }
  Zotero.alert(window, "Reload Metadata", message);
}

function startup({ id }) {
  for (let window of Zotero.getMainWindows()) {
    addLocalization(window);
  }

  registeredMenuID = Zotero.MenuManager.registerMenu({
    menuID: "metadata-reload",
    pluginID: id,
    target: "main/library/item",
    menus: [{
      menuType: "menuitem",
      l10nID: "metadata-reload-menu",
      onShowing(_event, context) {
        context.setVisible(context.items.some(canRefresh));
        context.setEnabled(context.items.some(getAvailableDOI));
      },
      onCommand(event, context) {
        return refreshSelection(event.target.ownerGlobal, context.items);
      }
    }]
  });
}

function onMainWindowLoad({ window }) {
  addLocalization(window);
}

function onMainWindowUnload({ window }) {
  removeLocalization(window);
}

function shutdown(_data, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }
  if (registeredMenuID) {
    Zotero.MenuManager.unregisterMenu(registeredMenuID);
    registeredMenuID = undefined;
  }
  for (let window of Zotero.getMainWindows()) {
    removeLocalization(window);
  }
}
