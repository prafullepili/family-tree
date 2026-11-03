import TreePersonNode from './TreePersonNode.jsx';

export default function TreeNodeLayer({
  treePeople,
  layout,
  detailsOpen,
  selectedId,
  selectedNodeIds,
  highlightedLink,
  highlightedNetworkIds,
  familyColorsEnabled,
  familyColors,
  quickAddForId,
  aboutTooltipId,
  dismissedAboutTooltipId,
  setHighlightedNodeId,
  startDrag,
  drag,
  openPersonDetails,
  setQuickAddForId,
  openQuickAdd,
  openPersonEditor,
  setDetailsOpen,
  setMobileDetailsOpen,
  setDismissedAboutTooltipId,
  setAboutTooltipId,
  setSelectedId,
  setSelectedNodeIds,
  setConfirmDelete,
}) {
  return (
    <>
      {treePeople.map((person) => {
                  const pos = layout.positions.get(person.id);
                  const isDetailsVisible = detailsOpen && selectedId === person.id;
                  return (
                    <TreePersonNode
                      key={person.id}
                      person={person}
                      position={pos}
                      detailsVisible={isDetailsVisible}
                      linkHighlighted={highlightedLink?.ids?.includes(person.id)}
                      networkHighlighted={highlightedNetworkIds.has(person.id)}
                      selected={selectedId === person.id || selectedNodeIds.includes(person.id)}
                      familyColorIndex={familyColorsEnabled && familyColors.has(person.id) ? familyColors.get(person.id) : null}
                      quickAddOpen={quickAddForId === person.id}
                      aboutOpen={aboutTooltipId === person.id}
                      aboutDismissed={dismissedAboutTooltipId === person.id}
                      onHoverStart={() => setHighlightedNodeId(person.id)}
                      onHoverEnd={() => setHighlightedNodeId((current) => (current === person.id ? '' : current))}
                      onTouchDragStart={(event) => startDrag(event, person, pos)}
                      onTouchPointerUp={() => {
                        if (drag.current?.id === person.id && !drag.current.moved) {
                          setHighlightedNodeId((current) => (current === person.id ? '' : person.id));
                        }
                      }}
                      onMouseDragStart={(event) => startDrag(event, person, pos)}
                      onOpenFromKeyboard={() => openPersonDetails(person.id)}
                      onToggleQuickAdd={() => setQuickAddForId((current) => (current === person.id ? '' : person.id))}
                      onQuickAdd={(kind) => openQuickAdd(person, kind)}
                      onEdit={() => openPersonEditor(person)}
                      onToggleDetails={() => {
                        if (isDetailsVisible) {
                          setDetailsOpen(false);
                          setMobileDetailsOpen(false);
                        } else openPersonDetails(person.id);
                      }}
                      onRestoreAboutHover={() => setDismissedAboutTooltipId('')}
                      onToggleAbout={() => {
                        if (aboutTooltipId === person.id) {
                          setDismissedAboutTooltipId(person.id);
                          setAboutTooltipId('');
                        } else {
                          setDismissedAboutTooltipId('');
                          setAboutTooltipId(person.id);
                        }
                      }}
                      onDelete={() => {
                        setSelectedId(person.id);
                        setSelectedNodeIds([]);
                        setConfirmDelete(true);
                      }}
                    />
                  );
                })}
    </>
  );
}

