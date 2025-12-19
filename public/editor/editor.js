$(function () {
    let blockCounter = 0;

    const $editor = $('#editor');
    const $levelId = $('#level-id');

    const DEFAULT_SIZES = {
        block: { width: 100, height: 100 },
        enemy: { width: 80, height: 80 },
        catapult: { width: 80, height: 80 },
        bird: { width: 60, height: 60 },
        support: { width: 20, height: 100 }
    };

    function createBlock(blockData) {
        const type = blockData.type || "block";

        let id;
        if (blockData.id) {
            id = blockData.id;
        } else {
            blockCounter++;
            id = type + "-" + blockCounter;
        }

        const defaults = DEFAULT_SIZES[type] || DEFAULT_SIZES.block;

        const width = typeof blockData.width === "number" ? blockData.width : defaults.width;
        const height = typeof blockData.height === "number" ? blockData.height : defaults.height;
        const x = typeof blockData.x === "number" ? blockData.x : 10;
        const y = typeof blockData.y === "number" ? blockData.y : 10;

        const block = $('<div></div>')
            .addClass('block')
            .addClass('type-' + type)
            .attr('id', id)
            .attr('data-type', type)
            .css({
                top: y,
                left: x,
                width: width,
                height: height
            })
            .appendTo($editor);

        block.draggable({
            containment: "#editor"
        });

        block.on("contextmenu", function (e) {
            e.preventDefault();
            if (confirm("Delete this element?")) {
                $(this).remove();
            }
        });

        return block;
    }

    function collectBlocks() {
        const blocks = [];
        $(".block").each(function () {
            const b = $(this);
            const pos = b.position();
            blocks.push({
                id: b.attr('id'),
                type: b.data('type') || "block",
                x: pos.left,
                y: pos.top,
                width: b.width(),
                height: b.height()
            });
        });

        return blocks;
    }

    function renderLevel(blocks) {
        $editor.empty();
        blockCounter = 0;
        blocks.forEach(b => {
            createBlock(b);
        });
    }

    $('#add-block').click(function () {
        createBlock({ type: "block" });
    });

    $('#add-enemy').click(function () {
        createBlock({ type: "enemy" });
    });

    $('#add-catapult').click(function () {
        createBlock({ type: "catapult" });
    });

    $('#add-bird').click(function () {
        createBlock({ type: "bird" });
    });

    $('#add-support').click(function () {
        createBlock({ type: "support" });
    });

    $('#save-level').click(function () {
        const blocks = collectBlocks();

        if (blocks.length === 0) {
            alert('The level is empty. Add some blocks before saving.');
            return;
        }

        const id = $levelId.val().trim();
        const payload = { blocks };

        let method, url;
        if (id) {
            method = 'PUT';
            url = '/api/v1/levels/' + encodeURIComponent(id);
        } else {
            method = 'POST';
            url = '/api/v1/levels';
        }

        $.ajax({
            url,
            method,
            contentType: 'application/json',
            data: JSON.stringify(payload),
            success: function (response) {
                alert(response.message + ' (ID = ' + response.id + ')');
                if (!id) {
                    $levelId.val(response.id);
                }
            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error saving level: ' + msg);
            }
        });
    });

    $('#load-level').click(function () {
        const id = $levelId.val().trim();

        if (!id) {
            alert('Please enter a Level ID to load.');
            return;
        }

        const url = '/api/v1/levels/' + encodeURIComponent(id);

        $.ajax({
            url,
            method: 'GET',
            contentType: 'application/json',
            success: function (response) {
                renderLevel(response.blocks || []);
                alert('Level loaded successfully.');
            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error loading level: ' + msg);
            }
        });
    });

    $('#delete-level').click(function () {
        const id = $levelId.val().trim();

        if (!id) {
            alert('Please enter a Level ID to delete.');
            return;
        }

        if (!confirm(`Are you sure you want to delete level "${id}"?`)) {
            return;
        }

        const url = '/api/v1/levels/' + encodeURIComponent(id);

        $.ajax({
            url,
            method: 'DELETE',
            success: function () {
                alert('Level deleted.');
                $levelId.val('');
                $editor.empty();
            },
            error: function (xhr) {
                const msg = xhr.responseJSON?.error || xhr.responseText || 'Unknown error';
                alert('Error deleting level: ' + msg);
            }
        });
    });
});
