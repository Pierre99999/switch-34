-- Optional. The three "prepared" zones (product & positioning, terrain,
-- necessary actor) moved to the Sales Playbook, which holds them once for the
-- company instead of once per deal. Nothing reads these rows any more; this
-- only removes the dead weight.
delete from deal_boxes where box_id in ('product', 'fit', 'necessary-actor');
