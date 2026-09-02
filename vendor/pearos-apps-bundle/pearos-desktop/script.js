// CONTINUUM UI

$(function() {
	sWindowUI();
	// $(".enableTestPanel").mousedown(function() {
	// 	$(".sPanelTest").toggleClass("disabled");
	// });
// 	$(".testCreateW").click(function() {
// 		createWindow(
// 			"testImage",
// 			"Hi this is a test (also in dev, sorry 😔)",
// 			200,
// 			80,
// 			true,
// 			true
// 		);
// 	}
// );
	$(".testCreateWi").click(function() {
		createWindow(
			"test",
			"<div class='img' style='background-image:url(https://i.imgur.com/8hnWJjq.jpg)'></div>",
			200,
			80,
			true,
			true
		);
	}
);
	// Window size

	var zIndex = 1,
		fullHeight = $(window).height(),
		fullWidth = $(window).width();

	$(window).resize(function() {
		fullWidth = $(window).width();
		fullHeight = $(window).height();

		$(".window").draggable({
			containment: [
				-1 * $(".desktop").width(),
				22,
				$(".desktop").width(),
				$(".desktop").height()
			]
		});
	});

	$(".canCheck").click(function() {
		// Make checking bidirectional between canCheck and checkable

		if (
			$(this)
				.find("input")
				.is(":checked")
		) {
			$(
				".checkable[data-trigger='" +
					$(this)
						.find("input")
						.attr("class") +
					"']"
			).attr("data-checked", "true");
			$(
				"[" +
					$(this)
						.find("input")
						.attr("class") +
					"]"
			).attr($(this)
						.find("input")
						.attr("class"), "true");
		} else {
			$(
				".checkable[data-trigger='" +
					$(this)
						.find("input")
						.attr("class") +
					"']"
			).attr("data-checked", "false");
			$(
				"[" +
					$(this)
						.find("input")
						.attr("class") +
					"]"
			).attr($(this)
						.find("input")
						.attr("class"), "false");
		}

	});
	$(".canCheck .status").click(function() {
		$(this).toggleClass("checked");
		if ($(this).hasClass("sEnergySaver")) {
			if ($(this).hasClass("sEnergySaver") & $(this).hasClass("checked")) {
				$(".powerIcon")
					.parent()
					.addClass("eco");
			} else {
				$(".powerIcon")
					.parent()
					.removeClass("eco");
			}
		}
	});


	$("[data-search]").on("keyup", function() {
		var searchVal = $(this).val();
		var filterItems = $("[data-filter-item], .sep");

		if (searchVal != "") {
			filterItems.addClass("noMatch");
			$(
				'[data-filter-item][data-filters*="' + searchVal.toLowerCase() + '"]'
			).removeClass("noMatch");
		} else {
			filterItems.removeClass("noMatch");
		}
	});

	// Variabile pentru selecție desktop (globale)
	window.isSelecting = false;
	let selectionStartX = 0;
	let selectionStartY = 0;
	let selectionBox = null;
	let selectedIcons = [];

	// Variabile pentru "shake to find cursor" (macOS style)
	let lastMouseX = 0;
	let lastMouseY = 0;
	let lastMouseTime = 0;
	let cursorMagnifyTimer = null;
	let rapidMovements = 0; // Contor pentru mișcări rapide consecutive
	const MOUSE_SPEED_THRESHOLD = 100; // pixels per frame pentru a considera mișcarea rapidă
	const RAPID_MOVEMENTS_NEEDED = 2; // Numărul de mișcări rapide consecutive necesare
	const CURSOR_HIDE_DELAY = 600; // ms după care revine cursorul la normal
	let cursorOverlay = null; // Overlay pentru cursorul animat

	$(".desktop").mousedown(function(e) {
		// appMenuClose(); // COMENTAT - nu mai există
		// sActionbarBlur(); // COMENTAT - nu mai există
		
		// Verifică dacă click-ul este pe desktop (nu pe o iconiță sau fereastră)
		const target = $(e.target);
		if (target.closest('.desktop-icon').length === 0 && 
		    target.closest('.window').length === 0 &&
		    target.closest('.taskbar').length === 0 &&
		    target.closest('.actionbar').length === 0 &&
		    target.closest('.appMenu').length === 0) {
			
			// Ascunde/minimizează ferestrele deschise (comportament desktop real)
			// Ascunde ferestrele din aplicație
			$('.window:visible').each(function() {
				$(this).fadeOut(200);
			});
			
			// Minimizează ferestrele din sistem (exceptând aplicația desktop)
			if (window.electronAPI && window.electronAPI.minimizeAllWindows) {
				window.electronAPI.minimizeAllWindows().catch(err => {
					console.log('Nu s-au putut minimiza ferestrele din sistem:', err);
				});
			}
			
			// Începe selecția
			window.isSelecting = true;
			isSelecting = true;
			selectionStartX = e.pageX;
			selectionStartY = e.pageY;
			
			// Dacă nu se ține Ctrl, deselectează toate iconițele
			if (!e.ctrlKey && !e.metaKey) {
				$('.desktop-icon').removeClass('selected');
				selectedIcons = [];
			}
			
			// Creează dreptunghiul de selecție
			if (!selectionBox) {
				selectionBox = $('<div>').addClass('desktop-selection-box').css({
					position: 'absolute',
					border: '1px solid rgba(255, 255, 255, 0.8)',
					background: 'rgba(255, 255, 255, 0.1)',
					pointerEvents: 'none',
					zIndex: 9999,
					display: 'none'
				});
				$('.desktop').append(selectionBox);
			}
			
			selectionBox.css({
				left: selectionStartX + 'px',
				top: selectionStartY + 'px',
				width: '0px',
				height: '0px',
				display: 'block'
			});
		} else {
			if ($(".desktop").has(e.target).length === 0) {
				$(".window").removeClass("window--active");
			}
		}
	});

	$(document).mousemove(function(e) {
		// "Shake to find cursor" - detectează mișcarea rapidă
		const currentTime = Date.now();
		const currentX = e.pageX;
		const currentY = e.pageY;
		
		// Actualizează poziția overlay-ului cursorului
		updateCursorOverlayPosition(currentX, currentY);
		
		if (lastMouseTime > 0) {
			const timeDelta = currentTime - lastMouseTime;
			const distance = Math.sqrt(
				Math.pow(currentX - lastMouseX, 2) + 
				Math.pow(currentY - lastMouseY, 2)
			);
			const speed = timeDelta > 0 ? distance / timeDelta * 16.67 : 0; // Normalizează la ~60fps
			
			if (speed > MOUSE_SPEED_THRESHOLD) {
				// Mișcare rapidă detectată - incrementează contorul
				rapidMovements++;
				if (rapidMovements >= RAPID_MOVEMENTS_NEEDED) {
					// Mărește cursorul doar după mai multe mișcări rapide consecutive
					magnifyCursor();
				}
			} else {
				// Dacă viteza scade, resetează contorul gradual
				if (rapidMovements > 0) {
					rapidMovements = Math.max(0, rapidMovements - 1);
				}
			}
		}
		
		lastMouseX = currentX;
		lastMouseY = currentY;
		lastMouseTime = currentTime;
		
		// Resetează timer-ul pentru revenirea cursorului la normal
		if (cursorMagnifyTimer) {
			clearTimeout(cursorMagnifyTimer);
		}
		cursorMagnifyTimer = setTimeout(function() {
			normalizeCursor();
			rapidMovements = 0; // Resetează contorul când cursorul revine la normal
		}, CURSOR_HIDE_DELAY);
		
		if (window.isSelecting && selectionBox) {
			const left = Math.min(selectionStartX, currentX);
			const top = Math.min(selectionStartY, currentY);
			const width = Math.abs(currentX - selectionStartX);
			const height = Math.abs(currentY - selectionStartY);
			
			selectionBox.css({
				left: left + 'px',
				top: top + 'px',
				width: width + 'px',
				height: height + 'px'
			});
			
			// Verifică care iconițe sunt în selecție
			updateIconSelection(left, top, width, height);
		}
	});
	
	// Funcții pentru mărirea cursorului
	function createCursorOverlay() {
		if (!cursorOverlay) {
			cursorOverlay = $('<div>').addClass('cursor-magnified-overlay');
			$('body').append(cursorOverlay);
		}
		return cursorOverlay;
	}
	
	function updateCursorOverlayPosition(x, y) {
		if (cursorOverlay) {
			// Calculează offset-ul în funcție de starea cursorului (mare sau mic)
			const isMagnified = cursorOverlay.hasClass('visible');
			const offset = isMagnified ? 48 : 8; // 48px pentru cursor mare (96/2), 8px pentru mic (16/2)
			cursorOverlay.css({
				left: (x - offset) + 'px',
				top: (y - offset) + 'px'
			});
		}
	}
	
	function magnifyCursor() {
		if (!$('body').hasClass('cursor-magnified')) {
			$('body').addClass('cursor-magnified');
			const overlay = createCursorOverlay();
			
			// Actualizează poziția înainte de animație
			updateCursorOverlayPosition(lastMouseX, lastMouseY);
			
			// Animează mărirea cursorului
			setTimeout(function() {
				overlay.removeClass('hiding').addClass('visible');
				// Reactualizează poziția după ce se face mare (pentru offset corect)
				updateCursorOverlayPosition(lastMouseX, lastMouseY);
			}, 10);
			
			console.log('Cursor magnified - clasa adăugată');
		}
	}
	
	function normalizeCursor() {
		if ($('body').hasClass('cursor-magnified')) {
			const overlay = createCursorOverlay();
			
			// Animează revenirea la normal
			overlay.removeClass('visible').addClass('hiding');
			
			// Actualizează poziția pentru offset-ul corect când se face mic
			setTimeout(function() {
				updateCursorOverlayPosition(lastMouseX, lastMouseY);
			}, 10);
			
			// După ce animația se termină, elimină clasa și overlay-ul
			setTimeout(function() {
				$('body').removeClass('cursor-magnified');
				if (overlay && overlay.hasClass('hiding')) {
					overlay.remove();
					cursorOverlay = null;
				}
			}, 250); // Durata animației de fade out
			
			console.log('Cursor normalized - clasa eliminată');
		}
	}

	$(document).mouseup(function(e) {
		if (window.isSelecting) {
			window.isSelecting = false;
			isSelecting = false;
			if (selectionBox) {
				selectionBox.css({
					display: 'none'
				});
			}
		}
	});

	// Funcție pentru actualizarea selecției iconițelor
	function updateIconSelection(boxLeft, boxTop, boxWidth, boxHeight) {
		const boxRight = boxLeft + boxWidth;
		const boxBottom = boxTop + boxHeight;
		
		$('.desktop-icon').each(function() {
			const icon = $(this);
			const iconOffset = icon.offset();
			const iconLeft = iconOffset.left;
			const iconTop = iconOffset.top;
			const iconRight = iconLeft + icon.outerWidth();
			const iconBottom = iconTop + icon.outerHeight();
			
			// Verifică dacă iconița intersectează cu dreptunghiul de selecție
			const isInside = !(iconRight < boxLeft || iconLeft > boxRight || iconBottom < boxTop || iconTop > boxBottom);
			
			if (isInside) {
				if (!icon.hasClass('selected')) {
					icon.addClass('selected');
					if (selectedIcons.indexOf(icon[0]) === -1) {
						selectedIcons.push(icon[0]);
					}
				}
			} else {
				// Dacă nu se ține Ctrl, deselectează
				if (!$(document).data('ctrlKeyPressed')) {
					icon.removeClass('selected');
					const index = selectedIcons.indexOf(icon[0]);
					if (index > -1) {
						selectedIcons.splice(index, 1);
					}
				}
			}
		});
	}

	// Track Ctrl key pentru selecție multiplă
	$(document).keydown(function(e) {
		if (e.ctrlKey || e.metaKey) {
			$(document).data('ctrlKeyPressed', true);
		}
	});

	$(document).keyup(function(e) {
		if (!e.ctrlKey && !e.metaKey) {
			$(document).data('ctrlKeyPressed', false);
		}
	});

	// User logout
	function LockScreenCheckPass() {
		let password = $(".systemLockInput").val();
		$(".lockScreenLogIn").addClass("wait");
		$(".systemLockInput").blur();
		if (password === "123") {
			setTimeout(function() {
				$(".lockScreen").removeClass("locked");
				$(".lockScreenLogIn").removeClass("wait");
			}, 200);
		} else {
			setTimeout(function() {
				$(".lockScreenLogIn")
					.addClass("wrong")
					.removeClass("wait");
				$(".systemLockInput").focus();
			}, 2000);
		}
	}
	$('[data-trigger="sActionLogout"]').click(function() {
		$(".systemLockInput").val("");
		$(".lockScreenLogIn").removeClass("wait");
		$(".login").addClass("empty");
		setTimeout(function() {
			appMenuClose();
			$(".systemLockInput").focus();
		}, 200);
		$(".lockScreen").addClass("locked");
	});
	$(".login").click(function() {
		$(".lockScreenLogIn").removeClass("wrong");
		LockScreenCheckPass();
	});
	$(".systemLockInput").keyup(function(e) {
		if (e.keyCode === 13 || e.which == 13) {
			LockScreenCheckPass();
		} else {
			$(".lockScreenLogIn").removeClass("wrong");
			if (!($(".systemLockInput").val() == "")) {
				$(".login").removeClass("empty");
			} else {
				$(".login").addClass("empty");
			}
		}
	});

	// User inactivity procedure
	var idleTime = 0;
	var idleInterval = setInterval(timerIncrement, 60000);
	$('[data-tigger="sActionSleep"]').click(function() {
		sSleep();
	});
	function sSleep() {
		$("body").addClass("sleep");
	}
	function sWakeUp() {
		$("body").removeClass("sleep");
	}
	$(this).mousemove(function(e) {
		idleTime = 0;
		sWakeUp();
	});
	$(this).keypress(function(e) {
		idleTime = 0;
		sWakeUp();
	});
	function timerIncrement() {
		idleTime = idleTime + 1;
		if (idleTime > 59) {
			$(".logout").click();
		}
		if (idleTime > 60) {
			sSleep();
		}
		if (idleTime > 0 && $(".lockScreen").hasClass("locked")) {
			sSleep();
		}
	}

	// === Notifications system ===

	function sNotificationDiscard(n) {
		n.addClass("close");
		setTimeout(function() {
			n.remove();
			sNotificationFlag();
		}, 300);
	}
	function sNotificationFlag() {
		if (!$(".sPanelNotifications .item").length) {
			$(".sActionbarNotifications").removeClass("hasNotifications");
			$('[sSwitchId="notifications"]').addClass("empty");
		} else {
			$('[sSwitchId="notifications"]').removeClass("empty");
			$(".sActionbarNotifications").addClass("hasNotifications");
		}
	}
	$(".sPanelNotifications .item").draggable({
		axis: "x",
		scroll: false,
		containment: [fullWidth - 350, 0, fullWidth, 0],
		start: function() {
			$(this).css({ transition: "none" });
		},
		drag: function() {
			let opacity = (360 - $(this).position().left) / 360;
			$(this).css({ opacity: opacity });
		},
		stop: function() {
			let left = $(this).position().left;
			if (left > 80) {
				sNotificationDiscard($(this));
			} else {
				$(this).css({
					left: 0,
					transition: "all .15s cubic-bezier(.63,.92,.68,.98)",
					opacity: 1
				});
			}
		}
	});

	$("[sSwitch] .option").click(function() {
		var sSwitchShow = $(this).attr("sSwitchShow");
		$(this)
			.parent()
			.parent()
			.parent()
			.children("[sSwitchId]")
			.attr("sSwitchVisibility", "disabled");
		$(this)
			.parent()
			.children(".option")
			.removeClass("active");
		$(this)
			.parent()
			.parent()
			.parent()
			.children("[sSwitchId='" + sSwitchShow + "']")
			.attr("sSwitchVisibility", "enabled");
		$(this).addClass("active");
	});

	// Notification widget

	$("#nWtime").mousedown(function(e) {
		let w = e.pageX - $("#nWtime").offset().left;
		$("#nWtimeH").css({ width: w });
	});
	$("#nWtimeH").resizable({
		handles: "e",
		minWidth: 7
	});

	// === Right Click ===
	/*$(document).bind("contextmenu",function(event){
		event.preventDefault();
	});*/
	// Variabile pentru sortare și opțiuni desktop
	window.desktopSortBy = localStorage.getItem('desktopSortBy') || 'none';
	window.desktopCleanUpBy = localStorage.getItem('desktopCleanUpBy') || 'name';
	window.desktopSnapToGrid = localStorage.getItem('desktopSnapToGrid') === 'true';
	window.desktopUseStacks = localStorage.getItem('desktopUseStacks') === 'true';
	
	// Variabilă pentru poziția click-ului dreapta (pentru New Folder)
	window.contextMenuClickPosition = null;

	// Funcție globală pentru a ascunde context menu-ul și a elimina efectul
	window.hideContextMenu = function() {
		const contextElement = $(".context");
		
		if (!contextElement.is(':visible')) {
			return;
		}
		
		contextElement.removeClass("liquid-glass");
		contextElement.fadeOut(50);
		
		// Oprește "always on top" când context menu-ul se închide
		if (window.electronAPI && window.electronAPI.setAlwaysOnTop) {
			window.electronAPI.setAlwaysOnTop(false).catch(err => {
				console.error('Eroare la oprirea always on top:', err);
			});
		}
	};

	$(document).bind("contextmenu", function(event) {
		event.preventDefault();
		let target = $(event.target);
		let cm = $(".context"); // Context menu
		
		// Salvează poziția click-ului pentru New Folder
		const desktopOffset = $('.desktop').offset();
		if (desktopOffset) {
			window.contextMenuClickPosition = {
				x: event.pageX - desktopOffset.left,
				y: event.pageY - desktopOffset.top
			};
		}
		
		function show() {
			const contextElement = $(".context");
			contextElement
				.addClass("liquid-glass")
				.fadeIn(50)
				.css({ top: event.pageY - 5, left: event.pageX + 2 });
			
			// Setează fereastra "always on top" când context menu-ul se afișează
			if (window.electronAPI && window.electronAPI.setAlwaysOnTop) {
				window.electronAPI.setAlwaysOnTop(true).catch(err => {
					console.error('Eroare la setarea always on top:', err);
				});
			}
		}
		
		// Verifică dacă click-ul este pe o iconiță desktop
		const desktopIcon = target.closest('.desktop-icon');
		const isDesktopIconClick = desktopIcon.length > 0;
		
		// Verifică dacă click-ul este pe desktop (nu pe iconiță, fereastră, taskbar, etc.)
		const isDesktopClick = target.closest('.desktop').length > 0 && 
		                      !isDesktopIconClick &&
		                      target.closest('.window').length === 0 &&
		                      target.closest('.taskbar').length === 0 &&
		                      target.closest('.actionbar').length === 0 &&
		                      target.closest('.appMenu').length === 0;
		
		if (isDesktopIconClick) {
			// Context menu pentru iconițe desktop
			const iconElement = desktopIcon;
			const filePath = iconElement.attr('data-file-path');
			const fileName = iconElement.attr('data-file-name');
			const isDirectory = iconElement.attr('data-is-directory') === 'true';
			
			// Selectează iconița
			if (!iconElement.hasClass('selected')) {
				if (!event.ctrlKey && !event.metaKey) {
					$('.desktop-icon').removeClass('selected');
				}
				iconElement.addClass('selected');
			}
			
			if (isDirectory) {
				// Context menu pentru directoare
				const cmSep = '<div class="sep"></div>';
				const folderMenu = `
					<div class="item folder-open">Open</div>
					${cmSep}
					<div class="item folder-move-to-trash">Move to Trash</div>
					${cmSep}
					<div class="item folder-get-info">Get Info</div>
					<div class="item folder-rename">Rename</div>
					<div class="item folder-compress">Compress "${fileName}"</div>
					<div class="item folder-duplicate">Duplicate</div>
					<div class="item folder-make-alias">Make Alias</div>
					<div class="item folder-quick-look">Quick Look</div>
					${cmSep}
					<div class="item folder-copy">Copy</div>
					<div class="item folder-share">Share</div>
					${cmSep}
					<div class="item folder-colors" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; gap: 4px;">
						<div class="folder-color-red" style="width: 16px; height: 16px; border-radius: 50%; background-color: #FF3B30; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-orange" style="width: 16px; height: 16px; border-radius: 50%; background-color: #FF9500; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-yellow" style="width: 16px; height: 16px; border-radius: 50%; background-color: #FFCC00; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-green" style="width: 16px; height: 16px; border-radius: 50%; background-color: #34C759; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-blue" style="width: 16px; height: 16px; border-radius: 50%; background-color: #007AFF; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-purple" style="width: 16px; height: 16px; border-radius: 50%; background-color: #AF52DE; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-grey" style="width: 16px; height: 16px; border-radius: 50%; background-color: #8E8E93; cursor: pointer; flex-shrink: 0;"></div>
						<div class="folder-color-customize" style="width: 16px; height: 16px; border-radius: 50%; background: linear-gradient(45deg, #FF3B30, #FF9500, #FFCC00, #34C759, #007AFF, #AF52DE, #8E8E93); cursor: pointer; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.3);"></div>
					</div>
					<div class="item folder-color-customize-text">Customize Folder</div>
					${cmSep}
					<div class="item folder-import-phone">Import from Phone</div>
					<div class="item folder-quick-actions">Quick Actions</div>
					${cmSep}
					<div class="item folder-actions-setup">Folder Actions Setup...</div>
					<div class="item folder-new-terminal">New Terminal at Folder</div>
				`;
				
				cm.html(folderMenu);
				show();
			} else {
				// Context menu pentru fișiere
				const cmSep = '<div class="sep"></div>';
				const fileMenu = `
					<div class="item file-open">Open</div>
					${cmSep}
					<div class="item file-move-to-trash">Move to Trash</div>
					${cmSep}
					<div class="item file-get-info">Get Info</div>
					<div class="item file-rename">Rename</div>
					<div class="item file-compress">Compress "${fileName}"</div>
					<div class="item file-duplicate">Duplicate</div>
					<div class="item file-make-alias">Make Alias</div>
					<div class="item file-quick-look">Quick Look</div>
					${cmSep}
					<div class="item file-copy">Copy</div>
					<div class="item file-share">Share</div>
					${cmSep}
					<div class="item file-import-phone">Import from Phone</div>
					<div class="item file-quick-actions">Quick Actions</div>
				`;
				
				cm.html(fileMenu);
				show();
			}
		} else if (isDesktopClick) {
			// Context menu pentru desktop
			const cmSep = '<div class="sep"></div>';
			const sortByLabel = window.desktopSortBy === 'none' ? 'None' : 
			                   window.desktopSortBy === 'dateLastOpened' ? 'Date Last Opened' :
			                   window.desktopSortBy === 'dateAdded' ? 'Date Added' :
			                   window.desktopSortBy === 'dateModified' ? 'Date Modified' :
			                   window.desktopSortBy === 'dateCreated' ? 'Date Created' :
			                   window.desktopSortBy.charAt(0).toUpperCase() + window.desktopSortBy.slice(1);
			
			const desktopMenu = `
				<div class="item desktop-new-folder">New Folder</div>
				${cmSep}
				<div class="item desktop-get-info">Get Info</div>
				<div class="item desktop-change-wallpaper">Change Wallpaper</div>
				<div class="item desktop-edit-widgets">Edit Widgets...</div>
				${cmSep}
				<div class="item desktop-use-stacks ${window.desktopUseStacks ? 'checked' : ''}">Use Stacks</div>
				<div class="item desktop-sort-by menu">
					Sort By: ${sortByLabel}
					<div class="submenu liquid-glass">
						<div class="item ${window.desktopSortBy === 'none' ? 'active' : ''}" data-sort="none">None</div>
						<div class="item ${window.desktopSortBy === 'name' ? 'active' : ''}" data-sort="name">Name</div>
						<div class="item ${window.desktopSortBy === 'kind' ? 'active' : ''}" data-sort="kind">Kind</div>
						<div class="item ${window.desktopSortBy === 'dateLastOpened' ? 'active' : ''}" data-sort="dateLastOpened">Date Last Opened</div>
						<div class="item ${window.desktopSortBy === 'dateAdded' ? 'active' : ''}" data-sort="dateAdded">Date Added</div>
						<div class="item ${window.desktopSortBy === 'dateModified' ? 'active' : ''}" data-sort="dateModified">Date Modified</div>
						<div class="item ${window.desktopSortBy === 'dateCreated' ? 'active' : ''}" data-sort="dateCreated">Date Created</div>
						<div class="item ${window.desktopSortBy === 'size' ? 'active' : ''}" data-sort="size">Size</div>
						<div class="item ${window.desktopSortBy === 'tags' ? 'active' : ''}" data-sort="tags">Tags</div>
					</div>
				</div>
				${cmSep}
				<div class="item desktop-snap-to-grid ${window.desktopSnapToGrid ? 'checked' : ''}">Snap to Grid</div>
				${cmSep}
				<div class="item desktop-clean-up">Clean Up</div>
				<div class="item desktop-clean-up-by menu">
					Clean Up By
					<div class="submenu liquid-glass">
						<div class="item" data-cleanup="name">Name</div>
						<div class="item" data-cleanup="kind">Kind</div>
						<div class="item" data-cleanup="dateModified">Date Modified</div>
						<div class="item" data-cleanup="dateCreated">Date Created</div>
						<div class="item" data-cleanup="size">Size</div>
						<div class="item" data-cleanup="tags">Tags</div>
					</div>
				</div>
				<div class="item desktop-show-view-options">Show View Options</div>
				${cmSep}
				<div class="item desktop-import-phone">Import from Phone</div>
			`;
			
			cm.html(desktopMenu);
			show();
		} else if (!target.closest(".window").hasClass("nocm")) {
			// Context menu pentru alte elemente (păstrează logica existentă)
			let cmSep = '<div class="sep"></div>',
				cmFilesys =
					'<div class="item">Copy</div><div class="item">Cut</div><div class="sep"></div><div class="item more">Share</div><div class="sep"></div><div class="item sFilesysDelete">Delete</div>',
				cmFilesysGetInfo = '<div class="item sFilesysGetInfo">Get Info</div>',
				cmFilesysInfo =
					'<div class="icon" data-type="' +
					target.attr("data-type") +
					'" data-name="' +
					target.attr("data-name") +
					'"></div><div class="text">Type:<i>' +
					target.attr("data-type") +
					'</i></div><div class="text">Name:<i>' +
					target.attr("data-name") +
					'</i></div><div class="text">Created on:<i>' +
					target.attr("data-date") +
					'</i></div><div class="text">Disk usage:<i>' +
					target.attr("data-bytes") +
					' bytes</i></div><div class="sep"></div><div class="item center">Close</div>',
				cmFilesysDeletePrompt =
					'<div class="icon" data-type="' +
					target.attr("data-type") +
					'" data-name="' +
					target.attr("data-name") +
					'"></div><div class="text center">Are you sure that you want to delete "' +
					target.attr("data-name") +
					'"?</div><div class="sep"></div><div class="item center sFilesysDeleteYes">Delete</div>',
				cmMessageCard =
					'<div class="item">Call</div><div class="item">Videochat</div><div class="sep"></div><div class="item">Mute</div><div class="item">Block</div>',
				cmNotificationItem =
					'<div class="item">Configure app banners</div><div class="item">Mute app</div><div class="sep"></div><div class="item sNotificationDiscard">Discard</div>',
				cmNotificationWidget =
					'<div class="item">Configure widget</div><div class="sep"></div><div class="item">Close app</div>',
				cmNotDefined = '<div class="item">Refresh</div>';
			if (target.hasClass("folder") || target.hasClass("file")) {
				AppFilesDeselect();
				target.addClass("selected");
				cm.html(cmFilesysGetInfo + cmSep + cmFilesys);
			} else if (
				target.hasClass("folder selected") ||
				target.hasClass("file selected")
			) {
				cm.html(cmFilesysGetInfo + cmSep + cmFilesys);
			} else if (target.hasClass("card")) {
				cm.html(cmMessageCard);
				show();
			} else {
				cm.html(cmNotDefined);
			}
		}
		cm.mousedown(function(event) {
			event.preventDefault(); // Previne comportamentul implicit
			event.stopPropagation(); // Previne propagarea evenimentului
			let target = $(event.target);
			if (target.hasClass("item")) {
				// Desktop menu actions
				if (target.hasClass("desktop-new-folder")) {
					event.preventDefault();
					event.stopPropagation();
					createNewFolder();
					hideContextMenu();
					return false; // Oprește procesarea ulterioară a evenimentului
				} else if (target.hasClass("desktop-get-info")) {
					showDesktopInfo();
					hideContextMenu();
				} else if (target.hasClass("desktop-change-wallpaper")) {
					changeWallpaper();
					hideContextMenu();
				} else if (target.hasClass("desktop-edit-widgets")) {
					editWidgets();
					hideContextMenu();
				} else if (target.hasClass("desktop-use-stacks")) {
					toggleUseStacks();
					hideContextMenu();
				} else if (target.hasClass("desktop-snap-to-grid")) {
					toggleSnapToGrid();
					hideContextMenu();
				} else if (target.hasClass("desktop-clean-up")) {
					cleanUpDesktop();
					hideContextMenu();
				} else if (target.closest(".desktop-clean-up-by").length && target.hasClass("item") && target.data("cleanup")) {
					const cleanUpBy = target.data("cleanup");
					setDesktopCleanUpBy(cleanUpBy);
					hideContextMenu();
				} else if (target.hasClass("desktop-show-view-options")) {
					showViewOptions();
					hideContextMenu();
				} else if (target.hasClass("desktop-import-phone")) {
					importFromPhone();
					hideContextMenu();
				} else if (target.closest(".desktop-sort-by").length && target.hasClass("item") && target.data("sort")) {
					const sortBy = target.data("sort");
					setDesktopSortBy(sortBy);
					hideContextMenu();
				}
				
				// Existing menu actions
				if (target.hasClass("sFilesysGetInfo")) {
					cm.html(cmFilesysInfo);
				}
				if (target.hasClass("sFilesysDelete")) {
					cm.html(cmFilesysDeletePrompt);
				}
				if (target.hasClass("sFilesysDeleteYes")) {
					let ObjectSelected = "";
					ObjectSelected = $(".filesys").find(".file.selected, .folder.selected");
					ObjectSelected.remove();
				}
				
				// Clipboard actions from context menu
				if (target.text().trim() === 'Copy') {
					handleCopy();
					hideContextMenu();
				} else if (target.text().trim() === 'Cut') {
					handleCut();
					hideContextMenu();
				} else if (target.text().trim() === 'Paste') {
					handlePaste();
					hideContextMenu();
				}
				
				// Folder context menu actions
				if (target.hasClass('folder-open')) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation(); // Oprește toate handler-ele
					const selectedIcon = $('.desktop-icon.selected');
					if (selectedIcon.length > 0) {
						const filePath = selectedIcon.attr('data-file-path');
						const isAppBundle = selectedIcon.attr('data-is-app-bundle') === 'true';
						const execPath = selectedIcon.attr('data-exec-path');
						
						if (filePath) {
							if (isAppBundle && execPath) {
								// Pentru .app bundles, rulează executabilul
								window.electronAPI.executeAppBundle(execPath).catch(error => {
									console.error('Eroare la executarea .app bundle:', error);
								});
							} else {
								// Pentru directoare normale, deschide-le
								window.electronAPI.openFile(filePath);
							}
						}
					}
					hideContextMenu();
					return false;
				} else if (target.hasClass('folder-move-to-trash')) {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteToTrash();
					hideContextMenu();
					return false;
				} else if (target.hasClass('folder-get-info')) {
					// TODO: Implement get info
					console.log('Get Info for folder');
					hideContextMenu();
				} else if (target.hasClass('folder-rename')) {
					event.preventDefault();
					event.stopPropagation();
					const selectedIcon = $('.desktop-icon.selected');
					if (selectedIcon.length > 0) {
						const startRename = selectedIcon.data('startRename');
						if (startRename && typeof startRename === 'function') {
							startRename();
						} else {
							// Fallback: obține informațiile despre fișier și activează rename manual
							const filePath = selectedIcon.attr('data-file-path');
							const fileName = selectedIcon.attr('data-file-name');
							const iconLabel = selectedIcon.find('.desktop-icon-label');
							const file = {
								path: filePath,
								name: fileName
							};
							startRenameIcon(selectedIcon, iconLabel, file);
						}
					}
					hideContextMenu();
					return false;
				} else if (target.hasClass('folder-compress')) {
					event.preventDefault();
					event.stopPropagation();
					handleCompress();
					hideContextMenu();
					return false;
				} else if (target.hasClass('folder-duplicate')) {
					event.preventDefault();
					event.stopPropagation();
					handleDuplicate();
					hideContextMenu();
					return false;
				} else if (target.hasClass('folder-make-alias')) {
					event.preventDefault();
					event.stopPropagation();
					handleMakeAlias();
					hideContextMenu();
					return false;
				} else if (target.hasClass('folder-quick-look')) {
					// TODO: Implement quick look
					console.log('Quick Look');
					hideContextMenu();
				} else if (target.hasClass('folder-copy')) {
					handleCopy();
					hideContextMenu();
				} else if (target.hasClass('folder-share')) {
					// TODO: Implement share
					console.log('Share folder');
					hideContextMenu();
				} else if (target.hasClass('folder-color-red')) {
					// Handle folder color clicks (bilele colorate)
					// TODO: Implement folder color
					console.log('Set folder color: Red');
					hideContextMenu();
				} else if (target.hasClass('folder-color-orange')) {
					console.log('Set folder color: Orange');
					hideContextMenu();
				} else if (target.hasClass('folder-color-yellow')) {
					console.log('Set folder color: Yellow');
					hideContextMenu();
				} else if (target.hasClass('folder-color-green')) {
					console.log('Set folder color: Green');
					hideContextMenu();
				} else if (target.hasClass('folder-color-blue')) {
					console.log('Set folder color: Blue');
					hideContextMenu();
				} else if (target.hasClass('folder-color-purple')) {
					console.log('Set folder color: Purple');
					hideContextMenu();
				} else if (target.hasClass('folder-color-grey')) {
					console.log('Set folder color: Grey');
					hideContextMenu();
				} else if (target.hasClass('folder-color-customize') && !target.hasClass('folder-color-customize-text')) {
					// Click pe bilă colorată (gradient)
					console.log('Customize folder (color picker)');
					hideContextMenu();
				} else if (target.hasClass('folder-color-customize-text')) {
					// Click pe text "Customize Folder"
					// TODO: Implement customize folder
					console.log('Customize folder');
					hideContextMenu();
				} else if (target.hasClass('folder-import-phone')) {
					importFromPhone();
					hideContextMenu();
				} else if (target.hasClass('folder-quick-actions')) {
					// TODO: Implement quick actions
					console.log('Quick Actions');
					hideContextMenu();
				} else if (target.hasClass('folder-actions-setup')) {
					// TODO: Implement folder actions setup
					console.log('Folder Actions Setup');
					hideContextMenu();
				} else if (target.hasClass('folder-new-terminal')) {
					// TODO: Implement new terminal at folder
					console.log('New Terminal at Folder');
					hideContextMenu();
				}
				
				// File context menu actions
				if (target.hasClass('file-open')) {
					event.preventDefault();
					event.stopPropagation();
					event.stopImmediatePropagation(); // Oprește toate handler-ele
					const selectedIcon = $('.desktop-icon.selected');
					if (selectedIcon.length > 0) {
						const filePath = selectedIcon.attr('data-file-path');
						const isAppBundle = selectedIcon.attr('data-is-app-bundle') === 'true';
						const execPath = selectedIcon.attr('data-exec-path');
						
						if (filePath) {
							if (isAppBundle && execPath) {
								// Pentru .app bundles, rulează executabilul
								window.electronAPI.executeAppBundle(execPath).catch(error => {
									console.error('Eroare la executarea .app bundle:', error);
								});
							} else {
								// Pentru fișiere normale, deschide-le
								window.electronAPI.openFile(filePath);
							}
						}
					}
					hideContextMenu();
					return false;
					return false;
				} else if (target.hasClass('file-move-to-trash')) {
					event.preventDefault();
					event.stopPropagation();
					handleDeleteToTrash();
					hideContextMenu();
					return false;
				} else if (target.hasClass('file-get-info')) {
					// TODO: Implement get info
					console.log('Get Info for file');
					hideContextMenu();
				} else if (target.hasClass('file-rename')) {
					event.preventDefault();
					event.stopPropagation();
					const selectedIcon = $('.desktop-icon.selected');
					if (selectedIcon.length > 0) {
						const startRename = selectedIcon.data('startRename');
						if (startRename && typeof startRename === 'function') {
							startRename();
						} else {
							// Fallback: obține informațiile despre fișier și activează rename manual
							const filePath = selectedIcon.attr('data-file-path');
							const fileName = selectedIcon.attr('data-file-name');
							const iconLabel = selectedIcon.find('.desktop-icon-label');
							const file = {
								path: filePath,
								name: fileName
							};
							startRenameIcon(selectedIcon, iconLabel, file);
						}
					}
					hideContextMenu();
					return false;
				} else if (target.hasClass('file-compress')) {
					event.preventDefault();
					event.stopPropagation();
					handleCompress();
					hideContextMenu();
					return false;
				} else if (target.hasClass('file-duplicate')) {
					event.preventDefault();
					event.stopPropagation();
					handleDuplicate();
					hideContextMenu();
					return false;
				} else if (target.hasClass('file-make-alias')) {
					event.preventDefault();
					event.stopPropagation();
					handleMakeAlias();
					hideContextMenu();
					return false;
				} else if (target.hasClass('file-quick-look')) {
					// TODO: Implement quick look
					console.log('Quick Look for file');
					hideContextMenu();
				} else if (target.hasClass('file-copy')) {
					event.preventDefault();
					event.stopPropagation();
					handleCopy();
					hideContextMenu();
					return false;
				} else if (target.hasClass('file-share')) {
					// TODO: Implement share
					console.log('Share file');
					hideContextMenu();
				} else if (target.hasClass('file-import-phone')) {
					// TODO: Implement import from phone
					console.log('Import from Phone');
					hideContextMenu();
				} else if (target.hasClass('file-quick-actions')) {
					// TODO: Implement quick actions
					console.log('Quick Actions');
					hideContextMenu();
				}
			}
		});
		
		// Handler-ele pentru submeniuri sunt mutate la nivel de document pentru event delegation
		// Setting position when knowing context dimensions
		let y = Math.floor($(".context").position().top * -1);
		let x = Math.floor($(".context").position().left * -1);
		let h = Math.floor($(".context").height());
		let w = Math.floor($(".context").width());
		let dH = Math.floor($(".desktop").height());
		let dW = Math.floor($(".desktop").width());
		if (y * -1 + h + 50 > dH) {
			h = h + 10;
			cm.css({ top: event.pageY - h + 6 });
		}
		if (x * -1 + w + 50 > dW) {
			cm.css({ left: event.pageX - w });
		}
	});

	$(document).mousedown(function() {
		isHovered = $(".context").is(":hover");
		if (isHovered == true) {
			$(".context .item").mousedown(function() {
				if (window.hideContextMenu) {
					window.hideContextMenu();
				}
			});
		} else {
			if (window.hideContextMenu) {
				window.hideContextMenu();
			}
		}
	});

	function createWindow(data, content, width, height, tmp, bD) {
		let c = content,
			b,
			d = data,
			r = "";
		if (tmp) {
			r = "tmp";
			b = '<a class="window__close"></a>';
		} else {
			b =
				'<a class="window__close"></a><a class="window__minimize"></a><a class="window__maximize"></a>';
		}
		let w =
			'<div class="window window--' +
			d +
			" window--active " +
			r +
			'" data-window="' +
			d +
			'" data-windowBackdrop="' +
			bD +
			'" style="width:' +
			width +
			"px;height:" +
			height +
			"px;top:calc(50% - " +
			height / 2 +
			"px);left: calc(50% - " +
			width / 2 +
			'px);"><div class="window__handler ui-draggable-handle"><div class="window__controls">' +
			b +
			'</div></div><div class="window__body solidHandler"><div class="window__main">' +
			c +
			"</div></div></div>";
		$(".desktop").append(w);
		setTimeout(function() {
			sWindowActive($(".window[data-window='" + d + "']"));
		}, 1);
		// Make window Draggable and Resizable (and debug others that are not)
		sWindowUI();
		// Setting "close" button actions
		$(".window[data-window='" + d + "']")
			.find(".window__close")
			.mousedown(function() {
				let parentWindow = $(".window[data-window='" + d + "']");
				$(parentWindow).addClass("window--closing");
				setTimeout(function() {
					$(parentWindow)
						.hide()
						.removeClass("window--closing");
					if (parentWindow.hasClass("tmp")) {
						$(".window[data-window='" + d + "']").remove();
					}
				}, 100);
			});
	}

	// Set window active when mousedown
	$(".desktop").mousedown(function(e) {
		sWindowUI();
		if ($(e.target).parents(".window").length) {
			sWindowActive($(e.target).parents(".window"));
		}
	});

	$(".window__actions a").click(function(e) {
		e.preventDefault();
	});
	
	function sWindowUI() {
		// Makes sure every window is draggable
		$(".desktop .window:not(.ui-draggable)").draggable({
			containment: [
				-1 * $(".desktop").width(),
				22,
				$(".desktop").width(),
				$(window).height()
			],
			handle: ".window__handler",
			start: function(event, ui) {
				sWindowActive($(this));
				if (window.hideContextMenu) {
					window.hideContextMenu();
				}
			},
			stop: function() {
				var initialHeight = $(this).height(),
					initialWidth = $(this).width(),
					initialTop = $(this).position().top,
					initialLeft = $(this).position().left;
			}
		});
		// Makes sure every window is resizable
		$(".desktop .window:not(.ui-resizable)").resizable({
			handles: "all",
			stop: function() {
				var initialHeight = $(this).height(),
					initialWidth = $(this).width(),
					initialTop = $(this).position().top,
					initialLeft = $(this).position().left;
			}
		});
		// Makes sure every window responds to window controls

		// Creates a taskbar icon for the app window (IN DEVELOPMENT)
	}

	function sWindowActive(window) {
		$(".window").removeClass("window--active");
		var appName = window.data("window");
		var targetWindow = $('.window[data-window="' + appName + '"]');
		window.addClass("window--active");
		window.css({ "z-index": zIndex++ });
		$(".taskbar__item[data-window]").removeClass("taskbar__item--active");
		$('.taskbar__item[data-window="' + appName + '"]')
			.addClass("taskbar__item--active")
			.addClass("taskbar__item--open");
	}

	if ($(this).hasClass("window--maximized")) {
		$(this).removeClass("window--maximized");

		$(this).css({ height: initialHeight, width: initialWidth, top: 0, left: 50 });
	}

	function openApp(e) {
		// Open app from taskbar
		var appName = $(this).data("window");
		var targetWindow = $('.window[data-window="' + appName + '"]');
		var targetTaskbar = $('.taskbarApp[data-window="' + appName + '"]');

		if ($(this).data("trigger") !== null && targetWindow == null || $(this).data("trigger") == null && targetWindow !== null) { 
				appMenuClose();
	  }
		e.preventDefault();

		if (targetWindow.is(":visible")) {
			if (targetWindow.hasClass("window--active")) {
				$(targetWindow).removeClass("window--minimized");

				if (!targetWindow.hasClass("window--minimized")) {
					var initialHeight = $(targetWindow).height(),
						initialWidth = $(targetWindow).width(),
						initialTop = $(targetWindow).position().top,
						initialLeft = $(targetWindow).position().left;

					$(".window").removeClass("window--active");

					$(targetWindow)
						.removeClass("window--closed")
						.addClass("window--active")
						.css({ "z-index": zIndex++, "pointer-events": "all", opacity: 1 });

					$(targetTaskbar).addClass("open");
				}
			} else {
				$(".window").removeClass("window--active");
				$(targetWindow)
					.removeClass("window--closed")
					.addClass("window--active")
					.css({ "z-index": zIndex++, "pointer-events": "all", opacity: 1 });
				if (targetWindow.hasClass("window--minimized")) {
					$(targetWindow).removeClass("window--minimized");
				}
				$(targetTaskbar).addClass("open");
			}
		} else {
			$(".window").removeClass("window--active");

			$('.window[data-window="' + appName + '"]')
				.removeClass("window--closed")
				.addClass("window--active")
				.css({ "z-index": zIndex++, "pointer-events": "all", opacity: 1 });

			setTimeout(function() {
				$('.window[data-window="' + appName + '"]').removeClass("window--opening");
			}, 0);

			$(targetTaskbar).addClass("open");
		}
	}

	$('.taskbarApp, [data-trigger="window"]').click(openApp);

	function centerApp(e) {
		//var appName = $(this).data("window"), targetWindow = $('.window[data-window="' + appName + '"]');
		var targetWindow = $('.window[data-window="' + $(this).data("window") + '"]');
		var setTop =
			$(window).height() / 2 - targetWindow.height() / 2 < 22
				? 22
				: $(window).height() / 2 - targetWindow.height() / 2;
		targetWindow.css({
			top: setTop,
			left: $(window).width() / 2 - targetWindow.width() / 2
		});
	}

	$('.taskbarApp, [data-trigger="window"]').dblclick(centerApp);

	function appMenuOpenApp(e) {
		var appName = $(this).data("window");
		var targetWindow = $('.window[data-window="' + appName + '"]');
		var targetTaskbar = $('.taskbarApp[data-window="' + appName + '"]');
		// Closes start menu when app is clicked
		appMenuClose();
		//setTimeout(function() {appMenuClose();}, 5);

		e.preventDefault();

		if (targetWindow.is(":visible")) {
			if (targetWindow.hasClass("window--active")) {
				$(targetWindow).removeClass("window--minimized");

				if (!targetWindow.hasClass("window--minimized")) {
					var initialHeight = $(targetWindow).height(),
						initialWidth = $(targetWindow).width(),
						initialTop = $(targetWindow).position().top,
						initialLeft = $(targetWindow).position().left;

					$(".window").removeClass("window--active");

					$(targetWindow)
						.removeClass("window--closed")
						.addClass("window--active")
						.css({ "z-index": zIndex++, "pointer-events": "all", opacity: 1 });

					$(targetTaskbar).addClass("open");
				}
			} else {
				$(".window").removeClass("window--active");
				$(targetWindow)
					.removeClass("window--closed")
					.addClass("window--active")
					.css({ "z-index": zIndex++, "pointer-events": "all", opacity: 1 });
				if (targetWindow.hasClass("window--minimized")) {
					$(targetWindow).removeClass("window--minimized");
				}
				$(targetTaskbar).addClass("open");
			}
		} else {
			$(".window").removeClass("window--active");
			$('.window[data-window="' + appName + '"]')
				.removeClass("window--closed")
				.addClass("window--active")
				.css({ "z-index": zIndex++, "pointer-events": "all", opacity: 1 });

			$(targetTaskbar).addClass("open");
		}
	}

	$(".app .icon").click(appMenuOpenApp);

	// Window controls

	$(".window__controls").each(function() {
		var parentWindow = $(this).closest(".window");
		var appName = $(parentWindow).data("window");

		$(this)
			.find("a")
			.click(function(e) {
				e.preventDefault();
			});

		$(this)
			.find(".window__close")
			.click(function(e) {
				$(parentWindow)
					.addClass("window--closed")
					.css({ "pointer-events": "none", opacity: 0 });
				//.addClass("window--closing")

				setTimeout(function() {
					//$(parentWindow).removeClass("window--closing");
					$(parentWindow).removeClass("window--active");
					if (parentWindow.hasClass("tmp")) {
						parentWindow.remove();
					}
				}, 1000);

				setTimeout(function() {
					$('.taskbarApp[data-window="' + appName + '"]').removeClass("open");
					$('.taskbar__item[data-window="' + appName + '"]').removeClass(
						"taskbar__item--open taskbar__item--active"
					);
				}, 1);
			});

		$(this)
			.find(".window__minimize")
			.click(function(e) {
				$(parentWindow).addClass("window--minimized");
				//$(parentWindow).css({'left' : window.innerWidth/2 - $(parentWindow).width()/2 });
				setTimeout(function() {
					$('.taskbar__item[data-window="' + appName + '"]').removeClass(
						"taskbar__item--active"
					);
				}, 1);
			});

		$(this)
			.find(".window__maximize")
			.click(function(e) {
				$(parentWindow).toggleClass("window--maximized");

				if (!$(parentWindow).hasClass("window--maximized")) {
					$(parentWindow).css({
						height: initialHeight,
						width: initialWidth,
						top: initialTop,
						left: initialLeft
					});
				} else {
					initialHeight = $(parentWindow).height();
					initialWidth = $(parentWindow).width();
					initialTop = $(parentWindow).position().top;
					initialLeft = $(parentWindow).position().left;

					$(parentWindow).css({
						height: fullHeight - 34,
						width: fullWidth,
						top: 0,
						left: 0
					});
				}
			});
	});
});


// OSDrivenBehavior

let OSDrivenBehavior = "Unknown OS";
if (navigator.appVersion.indexOf("Win") != -1) OSDrivenBehavior = "Windows";
else if (navigator.appVersion.indexOf("Mac") != -1) OSDrivenBehavior = "MacOS";
else if (navigator.appVersion.indexOf("X11") != -1) OSDrivenBehavior = "UNIX";
else if (navigator.appVersion.indexOf("Linux") != -1)
	OSDrivenBehavior = "Linux";

// $(".sPanelTest").html("Your OS: "+OSDrivenBehavior);

// KeyDrivenBehavior

let KeyDrivenBehavior;
function printOsAndKey() {
	// $(".sPanelTest").html("OS: " + OSDrivenBehavior + ", and key: " + KeyDrivenBehavior);
}
$(document)
	.keydown(function(event) {
		KeyDrivenBehavior = event.keyCode ? event.keyCode : event.which;
		printOsAndKey();
	})
	.keyup(function(event) {
		KeyDrivenBehavior = undefined;
		printOsAndKey();
	});
//$(document).keyup(function(event) {
//		KeyDrivenBehavior = undefined;
//	});

// --------------------
// EXPLORER
// --------------------

/*
AppExplorerData is the file system of the computer
t_ -> Type of object
	a_ file
	f_ folder
	...
	
n_ -> Name of the object

w_ -> Weight of the object in bytes

c_ -> Content of the object
	If is a folder it will contain another array []
	If is a file it will contain:
		t_ type of content (image, video, text, etc.)
		out_ the actual content
	
*/
var AppExplorerData = {
	recents: [
		{ t: "f", n: "Test folder", w: "0", c: [] },
		{
			t: "a",
			n: "testFile.txt",
			w: "200",
			d: "7/12/2019",
			c: [{ t: "text", out: "hello world!" }]
		}
	],
	downloads: [
		{
			t: "a",
			n: "test.jpg",
			w: "3802175",
			c: [{ t: "img", out: "https://bit.ly/36aJMdU" }]
		},
		{
			t: "a",
			n: "log.txt",
			w: "1026",
			c: [{ t: "text", out: "Hi this is a test :)" }]
		}
	],
	documents: [
		{ t: "f", n: "Github", w: "2965", c: [] },
		{ t: "f", n: "School", w: "4647639", c: [] },
		{ t: "f", n: "Future Projects", w: "87465934", c: [] },
		{
			t: "a",
			n: "IMG_0405.jpg",
			w: "94568",
			c: [{ t: "img", out: "https://bit.ly/33HGY7m" }]
		},
		{
			t: "a",
			n: "IMG_0406.jpg",
			w: "89456",
			c: [{ t: "img", out: "https://bit.ly/2Q8IhrY" }]
		},
		{
			t: "a",
			n: "Exercise 2 - Science (T3).xlsx",
			w: "2563",
			c: [
				{
					t: "xlsx",
					out:
						"Hi I´m Chandula, your local crazy developer, and I am trying to make an online functional OS (yeah, I am sooooo bored)"
				}
			]
		}
	],
	desktop: [],
	images: [],
	music: [],
	videos: [],
	apps: []
};



// Define system level

var syslvl = 0,
	syslvlNames = ["Root", "Admin", "User", "Guest"];

// Focus
$(".console-prompt-box").click(function() {
	$(".console-input").focus();
});

// Output to Console
function output(print) {
	var cmd = $(".console-input").val();
	if (cmd == "") {
		cmd = "<div class='err'>null</div>";
	}
	$("#outputs").append("<span class='output-cmd'>" + cmd + "</span>");

	$.each(print, function(index, value) {
		cmd = " >";
		if (value == "") {
			value = "&nbsp;";
			cmd = "&nbsp;";
		}
		$("#outputs").append("<span class='output-text'>" + value + "</span>");
	});

	$(".console-input").val("");
	$(".console-input").focus();
}

function sysIn(e) {
	return e ? ($(".console-input").val().split(" ").shift()) : ($(".console-input").val().split(" ").slice(1,$(".console-input").val().split(" ").length));
}

// Break Value
var newLine = "<br/> &nbsp;";

// User Commands

var helpInfo = [
	"clear",
	"help",
	"hist [-clear]",
	"syslvl [VALUE (0..3)]",
	"reload",
	"edit [-tab] [-debug]"
];

// "": function() {}
var cmds = {
	
	reload: function() {
		window.location.replace(location.href);
		output(["Reloading scripts ..."]);
	},

	edit: function(args) {
		var tab = (sysIn().indexOf("-tab") !== -1), debug = (sysIn().indexOf("-debug") !== -1);
		output(["Opening " + (debug ? "debug view " : "script ") + (tab ? "on a new tab" : "") + "..."]);
		window.open(debug ? "https://github.com/RedEdge967/MacOS-CSS" : "https://github.com/RedEdge967/MacOS-CSS", tab ? "_blank" : "_self");
	},
	
	test: function() {
		var str = "arguments given [" + sysIn() + "] and relevant are ";
		if (sysIn().indexOf("-ej") !== -1) {
			str += ", -ej";
		}
		if (sysIn().indexOf("-lol") !== -1) {
			str += ", -lol";
		}
		output([str]);
	},

	syslvl: function(a) {
		if (!(a == "")) {
			if (a > 3) {
				output(["<div class='err'>System Level Undefined</div>"]);
			} else {
				syslvl = a;
				output([syslvl + " - " + syslvlNames[syslvl]]);
			}
		} else {
			output([syslvl + " - " + syslvlNames[syslvl]]);
		}
	},

	clear: function() {
		output([""]);
		$("#outputs").html("");
	},

	hello: function() {
		output(["Hello there!"]);
	},

	hist: function(a) {
		if (a == "-clear") {
			prevCmd = [];
			output(["History successfully cleared"]);
		} else {
			output([prevCmd]);
		}
	},

	help: function(a) {
		if (a == "") {
			var print = ["Type 'help name' to find out more about the function 'name'.","Type 'help' to see this list."];
			print = $.merge(print, Object.values(helpInfo));
			output(print);
		} else {
			if (Object.keys(cmds).indexOf(sysIn().shift()) !== -1) {
				output(["'"+sysIn().shift()+"' is a command"]);
			} else {
				output(["<div class='err'>'"+sysIn().shift()+"' is not a command</div>"]);
			}
		}
	}
};

var prevCmd = [], prevCmdPointer = -1;

// Get User Command
$(".console-input").keydown(function(event) {
	
	function prevCmdAdd() {
		prevCmd.unshift($(".console-input").val());
	}

	if (
		(event.key === "Enter" || event.code == "Enter") &&
		!(
			$(this)
				.val()
				.replace(/ /g, "").length == 0
		)
	) {
		var str = $(this).val();
		var data = str.split(" ");
		data.shift();
		data = data.join(" ");
		var cmd = str.split(" ")[0];
		
		// Adds actual command to previous command list
		prevCmdAdd();
		
		if (typeof cmds[cmd] == "function") {
			if (cmds[cmd].length > 0) {
				cmds[cmd](data);
			} else {
				cmds[cmd]();
			}
		} else {
			output(["<div class='err'>Command not found: '" + cmd + "'</div>","Type 'help' for list of commands"]);
		}
		
		prevCmdPointer = -1;
		//$(this).val("");
		
	}
	else if (event.key === "ArrowUp" || event.code == "ArrowUp" || event.keyCode === 38) {
		event.preventDefault();
		if (prevCmdPointer < prevCmd.length) {
			prevCmdPointer++;
			$(".console-input").val(prevCmd[prevCmdPointer]);
		}
	}
	else if (event.key === "ArrowDown" || event.code == "ArrowDown" || event.keyCode === 40) {
		event.preventDefault();
		if (prevCmdPointer >= 0) {
			prevCmdPointer--;
			$(".console-input").val(prevCmd[prevCmdPointer]);
		}
	}
});

/* CLOCK & DATE*/

var clockVar = {};
renderTime();
function renderTime() {
	currentTime = new Date();
	clockVar.y = currentTime.getFullYear();
	clockVar.mth = currentTime.getMonth();
	clockVar.dt = currentTime.getDate();
	clockVar.d = currentTime.getDay();
	clockVar.h = currentTime.getHours();
	clockVar.m = currentTime.getMinutes();
	clockVar.s = currentTime.getSeconds();
	setTimeout("renderTime()", 100); //1000
	if (clockVar.h < 10) {
		clockVar.h = "0" + clockVar.h;
	}
	if (clockVar.m < 10) {
		clockVar.m = "0" + clockVar.m;
	}
	if (clockVar.s < 10) {
		clockVar.s = "0" + clockVar.s;
	}
	var months = [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December"
	];
	var monthsMin = [
		"jan",
		"feb",
		"mar",
		"apr",
		"may",
		"jun",
		"jul",
		"aug",
		"sep",
		"oct",
		"nov",
		"dec"
	];
	var days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday"
	];
	var daysMin = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	//let sTimeShowDate = $('.sTimeShowDate').hasClass('checked'), sTimeShowSeconds = $('.sTimeShowSeconds').hasClass('checked');
	let sTimeShowDate = $(".sTimeShowDate").is(":checked"),
		sTimeShowSeconds = $(".sTimeShowSeconds").is(":checked"),
		sDynamicWallpaper = $(".sDynamicWallpaper").is(":checked");

	var time = clockVar.h + ":" + clockVar.m;
	if (sTimeShowDate) {
		time =
			daysMin[clockVar.d] +
			" " +
			clockVar.dt +
			" " +
			monthsMin[clockVar.mth] +
			" " +
			time;
	}
	if (sTimeShowSeconds) {
		time = time + ":" + clockVar.s;
	}
	if (sDynamicWallpaper) {
		if (clockVar.h < 7 || clockVar.h > 18) {
			$("body").addClass("night");
		} else {
			$("body").removeClass("night");
		}
	}
	if (!sDynamicWallpaper) {
		$("body").addClass("night");
	}
	//$('.fullTime').html(clockVar.h + ":" + clockVar.m + ":" + clockVar.s);
	//$('.date').html(daysMin[clockVar.d] + " " + clockVar.dt + ", " + months[clockVar.mth] + " of " + clockVar.y);
	//$('.time').html(clockVar.h + ":" + clockVar.m);

	// Ordinal numbers function
	function nth(n) {
		return ["st", "nd", "rd"][((((n + 90) % 100) - 10) % 10) - 1] || "th";
	}
	// Clocks
	$(".time").html(time);
	$(".sActionbarTime").html(time);
	$(".currentTime").html(clockVar.h + ":" + clockVar.m + ":" + clockVar.s);
	$(".day").html(daysMin[clockVar.d]);
	$(".dayNumber").html(clockVar.dt);
	$(".month").html(months[clockVar.mth]);
	$(".year").html(clockVar.y);
	$(".sPanelNotifications .date .today").html(
		days[clockVar.d] +
			",<br>" +
			months[clockVar.mth] +
			" " +
			clockVar.dt +
			"<div class='ordinal'>" +
			nth(clockVar.dt) +
			"</div>"
	);
	$('[data-sGet="fullDate"]').html(
		days[clockVar.d] +
			", " +
			months[clockVar.mth] +
			" " +
			clockVar.dt +
			", " +
			clockVar.y
	);
}
$(document).ready(function() {
	// Handler pentru mousedown (se declanșează înainte de click)
	$(document).on('mousedown', function(event) {
		const contextElement = $(".context");
		// Verifică dacă click-ul este în afara context menu-ului
		// Exclude click-urile pe iconițe desktop care ar putea deschide context menu-ul
		if (contextElement.is(':visible') && 
		    !$(event.target).closest('.context').length &&
		    !$(event.target).closest('.desktop-icon').length) {
			if (window.hideContextMenu) {
				window.hideContextMenu();
			}
		}
	});
	
	// Handler pentru click-uri în afara context menu-ului (backup)
	$(document).on('click', function(event) {
		const contextElement = $(".context");
		// Verifică dacă click-ul este în afara context menu-ului
		if (contextElement.is(':visible') && 
		    !$(event.target).closest('.context').length &&
		    !$(event.target).closest('.desktop-icon').length) {
			if (window.hideContextMenu) {
				window.hideContextMenu();
			}
		}
	});
	
	// Handler-e pentru submeniuri la nivel de document (event delegation)
	// CSS-ul gestionează hover-ul, aici doar gestionăm click-urile
	
	// Handle click pe itemele din submenu Sort By
	$(document).on('click', '.context .desktop-sort-by .submenu .item', function(e) {
		e.stopPropagation();
		e.preventDefault();
		const sortBy = $(this).data('sort');
		if (sortBy) {
			setDesktopSortBy(sortBy);
			hideContextMenu();
		}
		return false;
	});
	
	// Handle click pe itemele din submenu Clean Up By
	$(document).on('click', '.context .desktop-clean-up-by .submenu .item', function(e) {
		e.stopPropagation();
		e.preventDefault();
		const cleanUpBy = $(this).data('cleanup');
		if (cleanUpBy) {
			setDesktopCleanUpBy(cleanUpBy);
			hideContextMenu();
		}
		return false;
	});
	
	// Handler pentru click-uri pe desktop (pentru a închide context menu-ul)
	$('.desktop').on('mousedown', function(event) {
		const contextElement = $(".context");
		if (contextElement.is(':visible') && !$(event.target).closest('.context').length) {
			if (window.hideContextMenu) {
				window.hideContextMenu();
			}
		}
	});

	// === Desktop Icons ===
	loadDesktopIcons().catch(error => {
		console.error('Eroare la încărcarea iconițelor desktop:', error);
	});
	
	// === Load Wallpaper ===
	loadCurrentWallpaper();
	
	// === Monitorizează schimbările de wallpaper din sistem ===
	startWallpaperMonitoring();
	
	// === Load Accent Color ===
	loadAccentColor();
	
	// === Gestionează drag-and-drop din alte aplicații în desktop ===
	setupFileDrop();
});

// Funcție pentru gestionarea drag-and-drop din alte aplicații în desktop
function setupFileDrop() {
	const desktopElement = $('.desktop');
	
	// Previne comportamentul default pentru a permite drop
	desktopElement.on('dragover', function(e) {
		e.preventDefault();
		e.stopPropagation();
		e.originalEvent.dataTransfer.dropEffect = 'copy';
	});
	
	// Gestionează drop-ul de fișiere
	desktopElement.on('drop', async function(e) {
		e.preventDefault();
		e.stopPropagation();
		
		// Obține poziția mouse-ului relativ la desktop
		const desktopOffset = desktopElement.offset();
		const dropX = e.originalEvent.clientX - desktopOffset.left;
		const dropY = e.originalEvent.clientY - desktopOffset.top;
		
		// Obține fișierele trase
		const files = e.originalEvent.dataTransfer.files;
		
		if (files && files.length > 0) {
			// Procesează fiecare fișier
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const sourcePath = file.path;
				
				if (sourcePath) {
					try {
						// Mută fișierul în Desktop la poziția mouse-ului
						const result = await window.electronAPI.moveFileToDesktop(sourcePath, null, dropX, dropY);
						
						if (result && result.success && result.path) {
							// Salvează poziția iconiței în localStorage
							const positions = loadIconPositions();
							positions[result.path] = {
								left: result.x,
								top: result.y
							};
							saveIconPositions(positions);
							
							// Reîncarcă iconițele desktop pentru a afișa noul fișier
							await loadDesktopIcons();
						}
					} catch (error) {
						console.error('Eroare la mutarea fișierului:', error);
					}
				}
			}
		}
	});
}

// Funcție pentru încărcarea wallpaper-ului actual din sistem
async function loadCurrentWallpaper() {
	const desktopElement = $('.desktop[sysDesktopBackground]');
	if (desktopElement.length === 0) return;
	
	// Verifică mai întâi dacă există un wallpaper salvat în localStorage
	const savedWallpaper = localStorage.getItem('selectedWallpaper');
	if (savedWallpaper) {
		// Folosește wallpaper-ul salvat
		desktopElement.css({
			'background-image': `url("${savedWallpaper}")`,
			'background-size': 'cover',
			'background-position': 'center',
			'background-repeat': 'no-repeat'
		});
		
		// Actualizează referința pentru monitorizare
		let wallpaperPath = savedWallpaper;
		if (wallpaperPath.startsWith('file://')) {
			wallpaperPath = wallpaperPath.substring(7);
		}
		currentSystemWallpaper = wallpaperPath;
		return;
	}
	
	// Altfel, încarcă wallpaper-ul din sistem
	if (!window.electronAPI || !window.electronAPI.getCurrentWallpaper) {
		console.log('Electron API pentru wallpaper nu este disponibil');
		return;
	}

	try {
		const wallpaper = await window.electronAPI.getCurrentWallpaper();
		if (wallpaper && wallpaper.path) {
			let wallpaperPath = wallpaper.path;
			
			// Elimină 'file://' dacă există
			if (wallpaperPath.startsWith('file://')) {
				wallpaperPath = wallpaperPath.substring(7);
			}
			
			// Salvează referința pentru monitorizare
			currentSystemWallpaper = wallpaperPath;
			
			// Adaugă 'file://' pentru a funcționa în browser
			if (!wallpaperPath.startsWith('file://')) {
				wallpaperPath = 'file://' + wallpaperPath;
			}
			
			// Setează wallpaper-ul ca background pentru desktop
			desktopElement.css({
				'background-image': `url("${wallpaperPath}")`,
				'background-size': 'cover',
				'background-position': 'center',
				'background-repeat': 'no-repeat'
			});
			
			// Salvează în localStorage
			localStorage.setItem('selectedWallpaper', wallpaperPath);
		} else {
			console.log('Nu s-a găsit wallpaper în sistem');
		}
	} catch (error) {
		console.error('Eroare la încărcarea wallpaper-ului:', error);
	}
}

// Variabilă pentru a stoca wallpaper-ul curent din sistem
let currentSystemWallpaper = null;
let wallpaperMonitorInterval = null;

// Funcție pentru monitorizarea schimbărilor de wallpaper din sistem
function startWallpaperMonitoring() {
	if (!window.electronAPI || !window.electronAPI.getCurrentWallpaper) {
		console.log('Electron API pentru wallpaper nu este disponibil pentru monitorizare');
		return;
	}
	
	// Verifică inițial wallpaper-ul din sistem
	checkSystemWallpaperChange();
	
	// Verifică la fiecare 2 secunde dacă wallpaper-ul s-a schimbat
	wallpaperMonitorInterval = setInterval(() => {
		checkSystemWallpaperChange();
	}, 2000);
}

// Funcție pentru verificarea schimbărilor de wallpaper din sistem
async function checkSystemWallpaperChange() {
	try {
		const wallpaper = await window.electronAPI.getCurrentWallpaper();
		
		if (wallpaper && wallpaper.path) {
			let wallpaperPath = wallpaper.path;
			
			// Normalizează calea
			if (wallpaperPath.startsWith('file://')) {
				wallpaperPath = wallpaperPath.substring(7);
			}
			
			// Verifică dacă wallpaper-ul s-a schimbat
			if (currentSystemWallpaper !== wallpaperPath) {
				// Dacă există un wallpaper salvat manual în localStorage, verifică dacă este diferit
				const savedWallpaper = localStorage.getItem('selectedWallpaper');
				
				// Dacă nu există wallpaper salvat manual SAU dacă wallpaper-ul din sistem este diferit de cel salvat
				// înseamnă că s-a schimbat din altă aplicație
				if (!savedWallpaper || !savedWallpaper.includes(wallpaperPath)) {
					// Wallpaper-ul s-a schimbat din altă aplicație
					currentSystemWallpaper = wallpaperPath;
					
					// Normalizează pentru browser
					let normalizedPath = wallpaperPath;
					if (!normalizedPath.startsWith('file://')) {
						normalizedPath = 'file://' + normalizedPath;
					}
					
					// Actualizează wallpaper-ul cu tranziție smooth
					applyWallpaperSmooth(normalizedPath);
					
					// Actualizează localStorage pentru a reflecta noul wallpaper
					localStorage.setItem('selectedWallpaper', normalizedPath);
					
					console.log('Wallpaper actualizat automat din sistem:', wallpaperPath);
				} else {
					// Wallpaper-ul este același cu cel salvat, doar actualizează referința
					currentSystemWallpaper = wallpaperPath;
				}
			}
		}
	} catch (error) {
		console.error('Eroare la verificarea wallpaper-ului din sistem:', error);
	}
}

// Funcție pentru încărcarea accent color-ului din sistem
async function loadAccentColor() {
	if (!window.electronAPI || !window.electronAPI.getAccent) {
		console.log('Electron API pentru accent color nu este disponibil');
		return;
	}

	try {
		const accentResult = await window.electronAPI.getAccent();
		if (accentResult && accentResult.accent) {
			const accentColorName = accentResult.accent.trim();
			
			// Maparea culorilor de accent (la fel ca în pearos-settings)
			const accentColors = {
				'purple': '#8B5CF6',
				'magenta': '#EC4899',
				'orange': '#F97316',
				'yellow': '#EAB308',
				'green': '#22C55E',
				'azul': '#06B6D4',
				'blue': '#3B82F6',
				'lila': '#A855F7',
				'dark-purple': '#6B21A8',
				'grey': '#6B7280'
			};
			
			const colorHex = accentColors[accentColorName] || accentColors['blue'];
			
			// Convertesc hex în RGB pentru transparență
			const hex = colorHex.replace('#', '');
			const r = parseInt(hex.substr(0, 2), 16);
			const g = parseInt(hex.substr(2, 2), 16);
			const b = parseInt(hex.substr(4, 2), 16);
			
			// Setează variabilele CSS
			const root = document.documentElement;
			root.style.setProperty('--accent-color', colorHex);
			root.style.setProperty('--accent-color-alpha', `rgba(${r}, ${g}, ${b}, 0.1)`);
		} else {
			// Default la blue
			const root = document.documentElement;
			root.style.setProperty('--accent-color', '#3B82F6');
			root.style.setProperty('--accent-color-alpha', 'rgba(59, 130, 246, 0.1)');
		}
	} catch (error) {
		console.error('Eroare la încărcarea accent color-ului:', error);
		// Default la blue în caz de eroare
		const root = document.documentElement;
		root.style.setProperty('--accent-color', '#3B82F6');
		root.style.setProperty('--accent-color-alpha', 'rgba(59, 130, 246, 0.1)');
	}
}

// Funcție pentru încărcarea iconițelor din ~/.Desktop
async function loadDesktopIcons() {
	if (!window.electronAPI) {
		console.log('Electron API nu este disponibil');
		return;
	}

	try {
		const result = await window.electronAPI.getDesktopFiles();
		const files = result.files || [];
		
		const desktopContainer = $('.desktop');
		if (desktopContainer.length === 0) {
			console.error('Containerul .desktop nu a fost găsit');
			return;
		}

		// Șterge iconițele existente (dacă există)
		$('.desktop-icon').remove();

		// Încarcă pozițiile salvate
		const savedPositions = loadIconPositions();
		
		// Curăță pozițiile pentru fișiere care nu mai există
		const existingPaths = new Set(files.map(f => f.path));
		const cleanedPositions = {};
		for (const [filePath, position] of Object.entries(savedPositions)) {
			if (existingPaths.has(filePath)) {
				cleanedPositions[filePath] = position;
			}
		}
		
		// Salvează pozițiile curățate
		if (Object.keys(cleanedPositions).length !== Object.keys(savedPositions).length) {
			saveIconPositions(cleanedPositions);
		}

		// Creează iconițele pentru fiecare fișier
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			await createDesktopIcon(file, i, cleanedPositions);
		}
	} catch (error) {
		console.error('Eroare la încărcarea fișierelor desktop:', error);
	}
}

// Funcție pentru încărcarea pozițiilor iconițelor din localStorage
function loadIconPositions() {
	try {
		const saved = localStorage.getItem('desktopIconPositions');
		return saved ? JSON.parse(saved) : {};
	} catch (error) {
		console.error('Eroare la încărcarea pozițiilor:', error);
		return {};
	}
}

// Funcție pentru salvarea pozițiilor iconițelor în localStorage
function saveIconPositions(positions) {
	try {
		localStorage.setItem('desktopIconPositions', JSON.stringify(positions));
	} catch (error) {
		console.error('Eroare la salvarea pozițiilor:', error);
	}
}

// Funcție pentru crearea unei iconițe desktop
async function createDesktopIcon(file, index, savedPositions) {
	const desktopContainer = $('.desktop');
	const desktopWidth = desktopContainer.width();
	const desktopHeight = desktopContainer.height();
	
	// Poziționare inițială la dreapta, vertical
	let left, top;
	const iconKey = file.path;
	
	if (savedPositions[iconKey]) {
		// Folosește poziția salvată
		left = savedPositions[iconKey].left;
		top = savedPositions[iconKey].top;
	} else {
		// Poziție inițială: la dreapta, vertical (20px margin de sus, 20px de la dreapta)
		const iconWidth = 120;
		const iconHeight = 120;
		const spacing = 130; // 120px height + 10px spacing
		const margin = 20;
		
		// Calculează câte iconițe încap vertical
		const iconsPerColumn = Math.floor((desktopHeight - margin * 2) / spacing);
		
		// Calculează rândul și coloana
		const row = index % iconsPerColumn;
		const column = Math.floor(index / iconsPerColumn);
		
		// Poziționează în grid, aliniat la dreapta
		const columnWidth = iconWidth + margin;
		left = desktopWidth - margin - iconWidth - (column * columnWidth);
		top = margin + row * spacing;
	}

	const iconElement = $('<div>')
		.addClass('desktop-icon')
		.css({
			position: 'absolute',
			left: left + 'px',
			top: top + 'px',
			width: '120px',
			height: '120px',
			cursor: 'default',
			textAlign: 'center',
			userSelect: 'none',
			zIndex: 10
		})
		.attr('data-file-path', file.path)
		.attr('data-file-name', file.name)
		.attr('data-is-directory', file.isDirectory ? 'true' : 'false')
		.attr('data-is-app-bundle', file.isAppBundle ? 'true' : 'false')
		.attr('data-exec-path', file.execPath || '');

	// Creează containerul pentru iconiță
	const iconImage = $('<div>')
		.addClass('desktop-icon-image')
		.css({
			width: '80px',
			height: '80px',
			margin: '0 auto 5px',
			backgroundSize: 'contain',
			backgroundRepeat: 'no-repeat',
			backgroundPosition: 'center',
			backgroundImage: 'url("https://raw.githubusercontent.com/aboredvaro/codepen_resources/main/macOS/img/system/icons/files/folder.png")'
		});

	// Creează eticheta pentru nume (editabilă)
	// Pentru .app bundles, folosește numele din Info.plist, altfel folosește numele fișierului
	const displayName = file.isAppBundle && file.name ? file.name : file.name;
	const iconLabel = $('<div>')
		.addClass('desktop-icon-label')
		.css({
			fontSize: '12px',
			color: 'white',
			textShadow: '0 1px 2px rgba(0,0,0,0.8)',
			wordWrap: 'break-word',
			maxWidth: '120px',
			lineHeight: '1.2',
			cursor: 'text'
		})
		.text(displayName)
		.attr('data-original-name', displayName);

	iconElement.append(iconImage);
	iconElement.append(iconLabel);
	desktopContainer.append(iconElement);

	// Încearcă să obțină iconița reală
	if (file.isDesktopFile && file.icon) {
		try {
			const iconResult = await window.electronAPI.getFileIcon(file.path, file.icon);
			if (iconResult && iconResult.iconPath) {
				// Folosește iconița găsită
				iconImage.css({
					backgroundImage: `url("file://${iconResult.iconPath}")`
				});
			}
		} catch (error) {
			console.error('Eroare la obținerea iconiței:', error);
		}
	} else if (file.isAppBundle && file.icon) {
		// Pentru .app bundles, folosește iconița din Contents/Resources/
		try {
			console.log('[APP] Setting icon for .app bundle:', file.name, 'icon path:', file.icon);
			
			// Verifică extensia iconiței
			const iconExt = file.icon.split('.').pop().toLowerCase();
			
			// Funcție helper pentru a normaliza path-ul pentru file:// URL
			const normalizeFileUrl = (filePath) => {
				if (filePath.startsWith('file://')) {
					return filePath;
				}
				// Normalizează path-ul: înlocuiește backslashes cu forward slashes și asigură că începe cu /
				const normalized = filePath.replace(/\\/g, '/');
				// Asigură că path-ul este absolut
				if (!normalized.startsWith('/')) {
					return `file:///${normalized}`;
				}
				return `file://${normalized}`;
			};
			
			if (iconExt === 'icns') {
				// Pentru .icns, convertește în PNG
				try {
					const convertResult = await window.electronAPI.convertIcnsToPng(file.icon);
					if (convertResult.success && convertResult.iconPath) {
						const iconUrl = normalizeFileUrl(convertResult.iconPath);
						iconImage.css({
							backgroundImage: `url("${iconUrl}")`,
							backgroundSize: 'contain',
							backgroundRepeat: 'no-repeat',
							backgroundPosition: 'center'
						});
						console.log('[APP] Icon converted and set to:', iconUrl);
					} else {
						// Fallback: încearcă să folosească iconița originală
						const iconUrl = normalizeFileUrl(file.icon);
						iconImage.css({
							backgroundImage: `url("${iconUrl}")`,
							backgroundSize: 'contain',
							backgroundRepeat: 'no-repeat',
							backgroundPosition: 'center'
						});
					}
				} catch (convertError) {
					console.error('[APP] Error converting .icns:', convertError);
					// Fallback la iconița originală
					const iconUrl = normalizeFileUrl(file.icon);
					iconImage.css({
						backgroundImage: `url("${iconUrl}")`,
						backgroundSize: 'contain',
						backgroundRepeat: 'no-repeat',
						backgroundPosition: 'center'
					});
				}
			} else {
				// Pentru PNG, SVG, JPG, folosește direct
				const iconUrl = normalizeFileUrl(file.icon);
				iconImage.css({
					backgroundImage: `url("${iconUrl}")`,
					backgroundSize: 'contain',
					backgroundRepeat: 'no-repeat',
					backgroundPosition: 'center'
				});
				console.log('[APP] Icon URL set to:', iconUrl);
			}
		} catch (error) {
			console.error('[APP] Eroare la încărcarea iconiței .app:', error);
		}
	} else if (file.isDirectory) {
		// Pentru directoare, folosește folder.svg cu accent color
		try {
			// Obține accent color
			const accentResult = await window.electronAPI.getAccent();
			const accentColorName = accentResult && accentResult.accent ? accentResult.accent.trim() : 'blue';
			
			// Maparea culorilor de accent
			const accentColors = {
				'purple': '#8B5CF6',
				'magenta': '#EC4899',
				'orange': '#F97316',
				'yellow': '#EAB308',
				'green': '#22C55E',
				'azul': '#06B6D4',
				'blue': '#3B82F6',
				'lila': '#A855F7',
				'dark-purple': '#6B21A8',
				'grey': '#6B7280'
			};
			
			const accentColor = accentColors[accentColorName] || accentColors['blue'];
			
			// Încarcă folder.svg și înlocuiește culoarea
			const folderSvgPath = 'svg/folder.svg';
			fetch(folderSvgPath)
				.then(response => response.text())
				.then(svgText => {
					// Înlocuiește #27d83d cu accent color
					const coloredSvg = svgText.replace(/#27d83d/g, accentColor);
					const svgBlob = new Blob([coloredSvg], { type: 'image/svg+xml' });
					const svgUrl = URL.createObjectURL(svgBlob);
					iconImage.css({
						backgroundImage: `url("${svgUrl}")`
					});
				})
				.catch(error => {
					console.error('Eroare la încărcarea folder.svg:', error);
					// Fallback la iconița default
					iconImage.css({
						backgroundImage: 'url("https://raw.githubusercontent.com/aboredvaro/codepen_resources/main/macOS/img/system/icons/files/folder.png")'
					});
				});
		} catch (error) {
			console.error('Eroare la obținerea iconiței pentru folder:', error);
			iconImage.css({
				backgroundImage: 'url("https://raw.githubusercontent.com/aboredvaro/codepen_resources/main/macOS/img/system/icons/files/folder.png")'
			});
		}
	} else if (file.isFile) {
		// Pentru fișiere, determină tipul după extensie și caută iconița în sistem
		const extension = file.name.split('.').pop().toLowerCase();
		const iconNameMap = {
			'png': 'image-x-generic',
			'jpg': 'image-x-generic',
			'jpeg': 'image-x-generic',
			'gif': 'image-x-generic',
			'pdf': 'application-pdf',
			'txt': 'text-x-generic',
			'doc': 'x-office-document',
			'docx': 'x-office-document',
			'zip': 'application-zip',
			'tar': 'application-x-tar',
			'xz': 'application-x-xz',
			'gz': 'application-x-compressed',
			'key': 'text-x-generic',
			'asc': 'text-x-generic',
			'conf': 'text-x-generic',
		};
		
		const iconName = iconNameMap[extension] || 'text-x-generic';
		
		try {
			const iconResult = await window.electronAPI.getFileIcon(file.path, iconName);
			if (iconResult && iconResult.iconPath) {
				iconImage.css({
					backgroundImage: `url("file://${iconResult.iconPath}")`
				});
			} else {
				// Fallback la iconița default
				iconImage.css({
					// backgroundImage: 'url("https://raw.githubusercontent.com/aboredvaro/codepen_resources/main/macOS/img/system/icons/files/document.png")'
				});
			}
		} catch (error) {
			console.error('Eroare la obținerea iconiței pentru fișier:', error);
			iconImage.css({
				// backgroundImage: 'url("https://raw.githubusercontent.com/aboredvaro/codepen_resources/main/macOS/img/system/icons/files/document.png")'
			});
		}
	}

	// Adaugă evenimente pentru click (doar dacă nu s-a făcut drag)
	let hasDragged = false;
	let clickTimer = null;
	
	iconElement.on('mousedown', function() {
		hasDragged = false;
	});
	
	// Click simplu pentru selecție
	iconElement.on('click', function(e) {
		// Previne click-ul dacă context menu-ul este deschis
		if ($('.context').is(':visible')) {
			e.stopPropagation();
			return;
		}
		
		// Previne click-ul dacă s-a făcut drag
		if (hasDragged) {
			e.stopPropagation();
			return;
		}
		
		// Dacă s-a făcut dublu-click, nu face nimic (va fi gestionat de dblclick)
		if (clickTimer) {
			clearTimeout(clickTimer);
			clickTimer = null;
			return;
		}
		
		// Setează un timer pentru click simplu
		clickTimer = setTimeout(function() {
			// Dacă se ține Ctrl sau Cmd, adaugă la selecție
			if (e.ctrlKey || e.metaKey) {
				if (iconElement.hasClass('selected')) {
					iconElement.removeClass('selected');
				} else {
					iconElement.addClass('selected');
				}
			} else {
				// Dacă nu se ține Ctrl, selectează doar această iconiță
				$('.desktop-icon').removeClass('selected');
				iconElement.addClass('selected');
			}
			clickTimer = null;
		}, 200); // Așteaptă 200ms pentru a vedea dacă este dublu-click
	});
	
	iconElement.on('dblclick', async function(e) {
		// Previne dublu-click-ul dacă context menu-ul este deschis
		if ($('.context').is(':visible')) {
			e.stopPropagation();
			return;
		}
		
		// Anulează timer-ul pentru click simplu
		if (clickTimer) {
			clearTimeout(clickTimer);
			clickTimer = null;
		}
		
		// Previne dublu-click-ul dacă s-a făcut drag
		if (hasDragged) {
			e.stopPropagation();
			return;
		}
		
		// Verifică dacă este un .app bundle
		const isAppBundle = iconElement.attr('data-is-app-bundle') === 'true';
		const execPath = iconElement.attr('data-exec-path');
		
		if (isAppBundle && execPath) {
			// Pentru .app bundles, rulează executabilul din Contents/PearOS
			try {
				console.log('[APP] Running .app bundle:', execPath);
				await window.electronAPI.executeAppBundle(execPath);
			} catch (error) {
				console.error('Eroare la executarea .app bundle:', error);
			}
		} else if (file.isDesktopFile) {
			try {
				await window.electronAPI.executeDesktopFile(file.path);
			} catch (error) {
				console.error('Eroare la executarea fișierului:', error);
			}
		} else {
			// Pentru directoare și fișiere normale, deschide cu aplicația default
			try {
				await window.electronAPI.openFile(file.path);
			} catch (error) {
				console.error('Eroare la deschiderea fișierului:', error);
			}
		}
	});

	// Nu mai adăugăm efect de hover
	let isDragging = false;

	// Adaugă eveniment dragstart nativ HTML5 pentru drag-and-drop către alte aplicații
	// Permite iconițelor să fie trase către alte aplicații (ex: terminal, file manager)
	iconElement[0].draggable = true;
	
	let isExternalDrag = false;
	let dragStartTime = 0;
	
	// Gestionează drag-and-drop către aplicații externe
	iconElement[0].addEventListener('dragstart', function(e) {
		// Setează path-ul fișierului în dataTransfer pentru a permite drag-and-drop către alte aplicații
		const filePath = iconElement.attr('data-file-path');
		if (filePath) {
			isExternalDrag = true;
			dragStartTime = Date.now();
			
			// Folosește text/uri-list pentru compatibilitate cu aplicații externe (Linux)
			e.dataTransfer.effectAllowed = 'copy';
			e.dataTransfer.setData('text/uri-list', `file://${filePath}`);
			e.dataTransfer.setData('text/plain', filePath);
			
			// Notifică main.js pentru a iniția drag-and-drop către aplicații externe
			// Aceasta va permite aplicațiilor externe să primească path-ul fișierului
			if (window.electronAPI && window.electronAPI.startDrag) {
				window.electronAPI.startDrag(filePath);
			}
		}
	}, true);
	
	iconElement[0].addEventListener('dragend', function(e) {
		isExternalDrag = false;
	});
	

	// Adaugă funcționalitate de drag & drop (jQuery UI pentru mutarea pe desktop)
	iconElement.draggable({
		containment: '.desktop',
		cursor: 'move',
		distance: 5, // Distanța minimă înainte de a începe drag-ul (previne drag accidental)
		start: function(event, ui) {
			// Previne drag-ul dacă se face selecție pe desktop
			if (window.isSelecting) {
				return false;
			}
			
			// Dacă se face drag către aplicații externe, nu folosi jQuery UI draggable
			if (isExternalDrag) {
				return false;
			}
			
			isDragging = true;
			hasDragged = false;
			
			const draggedIcon = $(this);
			const isSelected = draggedIcon.hasClass('selected');
			
			// Dacă iconița nu este selectată, selectează doar pe ea
			if (!isSelected) {
				$('.desktop-icon').removeClass('selected');
				draggedIcon.addClass('selected');
			}
			
			// Obține toate iconițele selectate
			const selectedIconsList = $('.desktop-icon.selected');
			
			// Salvează pozițiile inițiale și offset-urile relative
			draggedIcon.data('startPosition', ui.position);
			draggedIcon.data('selectedIcons', selectedIconsList);
			
			// Pentru fiecare iconiță selectată, salvează poziția inițială
			selectedIconsList.each(function() {
				const icon = $(this);
				const iconOffset = icon.offset();
				const draggedOffset = draggedIcon.offset();
				
				// Calculează offset-ul relativ față de iconița trasă
				icon.data('relativeOffset', {
					left: iconOffset.left - draggedOffset.left,
					top: iconOffset.top - draggedOffset.top
				});
				
				icon.css({
					transition: 'none',
					zIndex: 1000,
					opacity: 0.8
				});
			});
		},
		drag: function(event, ui) {
			// Previne drag-ul dacă se face selecție pe desktop
			if (window.isSelecting) {
				return false;
			}
			hasDragged = true;
			
			const draggedIcon = $(this);
			const selectedIconsList = draggedIcon.data('selectedIcons');
			
			// Mută toate iconițele selectate împreună
			if (selectedIconsList && selectedIconsList.length > 0) {
				const currentLeft = ui.position.left;
				const currentTop = ui.position.top;
				
				selectedIconsList.each(function() {
					const icon = $(this);
					// Nu muta iconița care este deja trasă (jQuery UI o mută automat)
					if (icon[0] !== draggedIcon[0]) {
						const relativeOffset = icon.data('relativeOffset');
						if (relativeOffset) {
							const newLeft = currentLeft + relativeOffset.left;
							const newTop = currentTop + relativeOffset.top;
							
							icon.css({
								left: newLeft + 'px',
								top: newTop + 'px'
							});
						}
					}
				});
			}
		},
		stop: function(event, ui) {
			// Previne drag-ul dacă se face selecție pe desktop
			if (window.isSelecting) {
				return false;
			}
			isDragging = false;
			
			const draggedIcon = $(this);
			const selectedIconsList = draggedIcon.data('selectedIcons');
			const positions = loadIconPositions();
			
			// Funcție helper pentru snap to grid (folosește același grid ca clean up)
			const snapToGrid = (x, y) => {
				if (!window.desktopSnapToGrid) {
					return { x: x, y: y };
				}
				const desktopContainer = $('.desktop');
				const desktopWidth = desktopContainer.width();
				const margin = 20;
				const iconWidth = 120;
				const spacing = 130; // 120px height + 10px spacing
				
				// Calculează poziția de start (la dreapta, ca în clean up)
				const startLeft = desktopWidth - margin - iconWidth;
				const startTop = margin;
				
				// Calculează celula de grid cea mai apropiată
				// Pentru X: aliniază la coloane (startLeft, startLeft - spacing, etc.)
				const columnOffset = startLeft - x;
				const columnIndex = Math.round(columnOffset / spacing);
				const snappedX = startLeft - (columnIndex * spacing);
				
				// Pentru Y: aliniază la rânduri (startTop, startTop + spacing, etc.)
				const rowOffset = y - startTop;
				const rowIndex = Math.round(rowOffset / spacing);
				const snappedY = startTop + (rowIndex * spacing);
				
				return { x: snappedX, y: snappedY };
			};
			
			// Salvează pozițiile tuturor iconițelor mutate
			if (selectedIconsList && selectedIconsList.length > 0) {
				selectedIconsList.each(function() {
					const icon = $(this);
					const iconKey = icon.attr('data-file-path');
					const iconOffset = icon.offset();
					const desktopOffset = $('.desktop').offset();
					
					let finalLeft = iconOffset.left - desktopOffset.left;
					let finalTop = iconOffset.top - desktopOffset.top;
					
					// Aplică snap to grid dacă este activat
					if (window.desktopSnapToGrid) {
						const snapped = snapToGrid(finalLeft, finalTop);
						finalLeft = snapped.x;
						finalTop = snapped.y;
						
						// Animează mutarea la poziția snapped
						icon.animate({
							left: finalLeft + 'px',
							top: finalTop + 'px'
						}, {
							duration: 200,
							easing: 'swing'
						});
					}
					
					positions[iconKey] = {
						left: finalLeft,
						top: finalTop
					};
					
					icon.css({
						transition: 'transform 0.2s',
						zIndex: 10,
						opacity: 1
					});
				});
			} else {
				// Dacă nu sunt selectate, salvează doar poziția iconiței trasă
				let finalLeft = ui.position.left;
				let finalTop = ui.position.top;
				
				// Aplică snap to grid dacă este activat
				if (window.desktopSnapToGrid) {
					const snapped = snapToGrid(finalLeft, finalTop);
					finalLeft = snapped.x;
					finalTop = snapped.y;
					
					// Animează mutarea la poziția snapped
					draggedIcon.animate({
						left: finalLeft + 'px',
						top: finalTop + 'px'
					}, {
						duration: 200,
						easing: 'swing'
					});
				}
				
				positions[iconKey] = {
					left: finalLeft,
					top: finalTop
				};
				
				draggedIcon.css({
					transition: 'transform 0.2s',
					zIndex: 10,
					opacity: 1
				});
			}
			
			saveIconPositions(positions);
			
			// Curăță datele temporare
			draggedIcon.removeData('startPosition');
			draggedIcon.removeData('selectedIcons');
			selectedIconsList.each(function() {
				$(this).removeData('relativeOffset');
			});
		}
	});
	
	// Funcție pentru activarea modului de editare
	iconElement.data('startRename', function() {
		startRenameIcon(iconElement, iconLabel, file);
	});
}

// Funcție pentru activarea modului de redenumire
function startRenameIcon(iconElement, iconLabel, file) {
	if (iconLabel.hasClass('editing')) {
		return; // Deja în mod editare
	}
	
	const originalName = iconLabel.text();
	const originalText = iconLabel.html();
	
	// Obține poziția label-ului relativ la iconiță
	const iconOffset = iconElement.offset();
	const labelOffset = iconLabel.offset();
	const labelPosition = iconLabel.position();
	
	// Creează input pentru editare
	const input = $('<input>')
		.attr('type', 'text')
		.attr('value', originalName)
		.css({
			position: 'absolute',
			left: labelPosition.left + 'px',
			top: labelPosition.top + 'px',
			width: '120px',
			minWidth: '120px',
			height: '20px',
			background: 'rgba(0, 106, 255, 0.9)',
			border: '1px solid rgba(255, 255, 255, 0.5)',
			borderRadius: '3px',
			padding: '2px 5px',
			fontSize: '12px',
			color: 'white',
			textAlign: 'center',
			outline: 'none',
			zIndex: 10000,
			boxSizing: 'border-box'
		});
	
	iconLabel.addClass('editing');
	iconLabel.css('opacity', '0');
	// Adaugă input-ul în iconElement (parent-ul label-ului) pentru poziționare corectă
	iconElement.append(input);
	
	// Selectează tot textul
	input.focus();
	input.select();
	
	// Salvează la Enter
	input.on('keydown', async function(e) {
		if (e.keyCode === 13 || e.which === 13) { // Enter
			e.preventDefault();
			const newName = $(this).val().trim();
			
			if (newName && newName !== originalName) {
				try {
					const result = await window.electronAPI.renameFile(file.path, newName);
					// Actualizează numele în UI
					iconLabel.text(newName);
					iconLabel.attr('data-original-name', newName);
					iconElement.attr('data-file-name', newName);
					
					// Actualizează path-ul dacă a fost returnat
					if (result && result.newPath) {
						const oldPath = iconElement.attr('data-file-path');
						iconElement.attr('data-file-path', result.newPath);
						
						// Actualizează pozițiile salvate cu noul path
						const positions = loadIconPositions();
						if (positions[oldPath]) {
							positions[result.newPath] = positions[oldPath];
							delete positions[oldPath];
							saveIconPositions(positions);
						}
						
						// Actualizează obiectul file pentru a reflecta noul path
						file.path = result.newPath;
						file.name = newName;
					}
				} catch (error) {
					console.error('Eroare la redenumire:', error);
					// Restaurează numele original
					iconLabel.text(originalName);
				}
			} else {
				// Dacă numele nu s-a schimbat sau este gol, restaurează
				iconLabel.text(originalName);
			}
			
			// Ieșire din mod editare
			input.remove();
			iconLabel.removeClass('editing');
			iconLabel.css('opacity', '1');
		} else if (e.keyCode === 27 || e.which === 27) { // Escape
			e.preventDefault();
			// Anulează editarea
			input.remove();
			iconLabel.removeClass('editing');
			iconLabel.css('opacity', '1');
			iconLabel.text(originalName);
		}
	});
	
	// Salvează la click în afara input-ului
	$(document).one('mousedown', function(e) {
		if (!input.is(e.target) && input.has(e.target).length === 0) {
			const newName = input.val().trim();
			
			if (newName && newName !== originalName) {
				window.electronAPI.renameFile(file.path, newName).then((result) => {
					iconLabel.text(newName);
					iconLabel.attr('data-original-name', newName);
					iconElement.attr('data-file-name', newName);
					
					// Actualizează path-ul dacă a fost returnat
					if (result && result.newPath) {
						const oldPath = iconElement.attr('data-file-path');
						iconElement.attr('data-file-path', result.newPath);
						
						// Actualizează pozițiile salvate cu noul path
						const positions = loadIconPositions();
						if (positions[oldPath]) {
							positions[result.newPath] = positions[oldPath];
							delete positions[oldPath];
							saveIconPositions(positions);
						}
						
						// Actualizează obiectul file pentru a reflecta noul path
						file.path = result.newPath;
						file.name = newName;
					}
				}).catch(error => {
					console.error('Eroare la redenumire:', error);
					iconLabel.text(originalName);
				});
			} else {
				iconLabel.text(originalName);
			}
			
			input.remove();
			iconLabel.removeClass('editing');
			iconLabel.css('opacity', '1');
		}
	});
}

// Event listener pentru Enter pe iconițe selectate
$(document).keydown(function(e) {
	// Verifică dacă Enter este apăsat și nu suntem într-un input
	if ((e.keyCode === 13 || e.which === 13) && !$(e.target).is('input, textarea')) {
		const selectedIcons = $('.desktop-icon.selected');
		
		// Dacă există exact o iconiță selectată, o redenumește
		if (selectedIcons.length === 1) {
			const iconElement = selectedIcons.first();
			const startRename = iconElement.data('startRename');
			if (startRename && typeof startRename === 'function') {
				startRename();
			}
		}
	}
});

	// Funcții pentru context menu desktop
	let isCreatingFolder = false; // Flag pentru a preveni apelurile multiple
	async function createNewFolder() {
		// Previne apelurile multiple simultane
		if (isCreatingFolder) {
			console.log('[FOLDER] Crearea folderului este deja în curs...');
			return;
		}
		
		if (!window.electronAPI || !window.electronAPI.createFolder) {
			console.error('Electron API pentru crearea folderului nu este disponibil');
			return;
		}
		
		isCreatingFolder = true; // Setează flag-ul
		
		try {
			// Nume default pentru folder nou
			let folderName = 'New Folder';
			let counter = 1;
			
			// Verifică dacă există deja un folder cu acest nume și incrementează contorul
			const checkFolderExists = async () => {
				try {
					const result = await window.electronAPI.getDesktopFiles();
					const files = result.files || [];
					const existingFolders = files.filter(f => f.isDirectory && f.name.startsWith(folderName));
					
					if (existingFolders.length > 0) {
						// Găsește primul număr disponibil
						const folderNames = existingFolders.map(f => f.name);
						while (folderNames.includes(folderName)) {
							folderName = `New Folder ${counter}`;
							counter++;
						}
					}
				} catch (error) {
					console.error('Eroare la verificarea folderelor existente:', error);
				}
			};
			
			await checkFolderExists();
			
			const result = await window.electronAPI.createFolder(folderName);
			if (result && result.success) {
				// Obține poziția click-ului sau folosește poziția default
				let newFolderPosition = null;
				if (window.contextMenuClickPosition) {
					// Ajustează poziția pentru centrarea iconiței (120px width, 120px height)
					newFolderPosition = {
						left: window.contextMenuClickPosition.x - 60, // Centrare pe X
						top: window.contextMenuClickPosition.y - 60   // Centrare pe Y
					};
				}
				
				// Salvează poziția pentru noul folder
				if (newFolderPosition) {
					const positions = loadIconPositions();
					positions[result.path] = {
						left: newFolderPosition.left,
						top: newFolderPosition.top
					};
					saveIconPositions(positions);
				}
				
				// Reîncarcă iconițele pentru a afișa noul folder
				await loadDesktopIcons();
				
				// Găsește iconița nou creată și activează modul de redenumire
				setTimeout(() => {
					const newFolderIcon = $(`.desktop-icon[data-file-path="${result.path}"]`);
					if (newFolderIcon.length > 0) {
						// Selectează iconița
						$('.desktop-icon').removeClass('selected');
						newFolderIcon.addClass('selected');
						
						// Activează modul de redenumire
						const iconLabel = newFolderIcon.find('.desktop-icon-label');
						const file = {
							path: result.path,
							name: folderName
						};
						startRenameIcon(newFolderIcon, iconLabel, file);
					}
				}, 100);
			}
		} catch (error) {
			console.error('Eroare la crearea folderului:', error);
			alert('Eroare la crearea folderului: ' + error.message);
		} finally {
			// Resetează flag-ul după ce operația este completă
			isCreatingFolder = false;
		}
	}

	function showDesktopInfo() {
		console.log('Get Info');
		// TODO: Implementează afișarea informațiilor despre desktop
	}

	async function changeWallpaper() {
		console.log('Change Wallpaper');
		
		if (!window.electronAPI || !window.electronAPI.selectWallpaperFile) {
			console.log('Electron API pentru selectarea wallpaper-ului nu este disponibil');
			return;
		}

		try {
			const result = await window.electronAPI.selectWallpaperFile();
			
			if (result && result.path) {
				let wallpaperPath = result.path;
				
				// Normalizează calea pentru a funcționa în browser
				if (!wallpaperPath.startsWith('file://')) {
					wallpaperPath = 'file://' + wallpaperPath;
				}
				
				// Salvează preferința în localStorage
				localStorage.setItem('selectedWallpaper', wallpaperPath);
				
				// Actualizează referința pentru monitorizare
				let normalizedPath = result.path;
				if (normalizedPath.startsWith('file://')) {
					normalizedPath = normalizedPath.substring(7);
				}
				currentSystemWallpaper = normalizedPath;
				
				// Aplică wallpaper-ul cu tranziție smooth
				applyWallpaperSmooth(wallpaperPath);
			}
		} catch (error) {
			console.error('Eroare la selectarea wallpaper-ului:', error);
		}
	}
	
	function applyWallpaperSmooth(wallpaperPath) {
		const desktopElement = $('.desktop[sysDesktopBackground]');
		if (desktopElement.length === 0) return;
		
		// Creează un element temporar pentru overlay cu noul wallpaper
		let overlay = $('.desktop-wallpaper-overlay');
		if (overlay.length === 0) {
			overlay = $('<div>').addClass('desktop-wallpaper-overlay');
			desktopElement.append(overlay);
		}
		
		// Setează noul wallpaper pe overlay
		overlay.css({
			'background-image': `url("${wallpaperPath}")`,
			'background-size': 'cover',
			'background-position': 'center',
			'background-repeat': 'no-repeat',
			'opacity': '0'
		});
		
		// Fade in overlay-ul nou
		setTimeout(() => {
			overlay.css('opacity', '1');
		}, 10);
		
		// După ce tranziția se termină, actualizează background-ul principal și elimină overlay-ul
		setTimeout(() => {
			desktopElement.css({
				'background-image': `url("${wallpaperPath}")`,
				'background-size': 'cover',
				'background-position': 'center',
				'background-repeat': 'no-repeat'
			});
			
			// Elimină overlay-ul după un mic delay
			setTimeout(() => {
				overlay.remove();
			}, 100);
		}, 600); // Durata tranziției
	}

	function editWidgets() {
		console.log('Edit Widgets');
		// TODO: Implementează editarea widget-urilor
	}

	function toggleUseStacks() {
		window.desktopUseStacks = !window.desktopUseStacks;
		localStorage.setItem('desktopUseStacks', window.desktopUseStacks);
		console.log('Use Stacks:', window.desktopUseStacks);
		// TODO: Implementează funcționalitatea Use Stacks
	}

	function toggleSnapToGrid() {
		window.desktopSnapToGrid = !window.desktopSnapToGrid;
		localStorage.setItem('desktopSnapToGrid', window.desktopSnapToGrid);
		console.log('Snap to Grid:', window.desktopSnapToGrid);
		// TODO: Implementează snap to grid
	}

	function setDesktopSortBy(sortBy) {
		window.desktopSortBy = sortBy;
		localStorage.setItem('desktopSortBy', sortBy);
		console.log('Sort By:', sortBy);
		// TODO: Implementează sortarea iconițelor
		sortDesktopIcons(sortBy);
	}

	function cleanUpDesktop() {
		console.log('Clean Up');
		const cleanUpBy = window.desktopCleanUpBy || 'name';
		cleanUpDesktopBy(cleanUpBy);
	}

	function setDesktopCleanUpBy(cleanUpBy) {
		window.desktopCleanUpBy = cleanUpBy;
		localStorage.setItem('desktopCleanUpBy', cleanUpBy);
		console.log('Clean Up By:', cleanUpBy);
		// TODO: Implementează clean up by efectiv
		cleanUpDesktopBy(cleanUpBy);
	}

	async function cleanUpDesktopBy(cleanUpBy) {
		console.log('Cleaning up desktop by:', cleanUpBy);
		
		// Obține toate iconițele de pe desktop
		const icons = $('.desktop-icon').toArray();
		if (icons.length === 0) {
			return;
		}
		
		// Colectează informațiile despre fiecare iconiță
		const iconData = [];
		for (const iconElement of icons) {
			const $icon = $(iconElement);
			const filePath = $icon.attr('data-file-path');
			const fileName = $icon.attr('data-file-name');
			
			if (!filePath) continue;
			
			// Obține informațiile despre fișier
			try {
				const result = await window.electronAPI.getDesktopFiles();
				const files = result.files || [];
				const fileInfo = files.find(f => f.path === filePath);
				
				if (fileInfo) {
					iconData.push({
						element: $icon,
						file: fileInfo,
						path: filePath,
						name: fileName || fileInfo.name
					});
				}
			} catch (error) {
				console.error('Eroare la obținerea informațiilor despre fișier:', error);
			}
		}
		
		// Sortează iconițele în funcție de criteriul ales
		iconData.sort((a, b) => {
			switch (cleanUpBy) {
				case 'name':
					return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
				case 'kind':
					// Sortează după tip: directoare, apoi fișiere
					if (a.file.isDirectory && !b.file.isDirectory) return -1;
					if (!a.file.isDirectory && b.file.isDirectory) return 1;
					// Dacă sunt același tip, sortează după nume
					return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
				case 'dateModified':
					return new Date(b.file.modified) - new Date(a.file.modified);
				case 'dateCreated':
					// Folosim modified dacă nu avem created
					return new Date(b.file.modified) - new Date(a.file.modified);
				case 'size':
					// Directoarele au size 0, le punem la început
					if (a.file.isDirectory && !b.file.isDirectory) return -1;
					if (!a.file.isDirectory && b.file.isDirectory) return 1;
					return (b.file.size || 0) - (a.file.size || 0);
				case 'tags':
					// Nu avem tags, sortează după nume
					return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
				default:
					return 0;
			}
		});
		
		// Repoziționează iconițele pe desktop (grid, aliniate la dreapta)
		const desktopContainer = $('.desktop');
		const desktopWidth = desktopContainer.width();
		const desktopHeight = desktopContainer.height();
		const iconWidth = 120;
		const iconHeight = 120;
		const margin = 20;
		const spacing = 130; // 120px height + 10px spacing
		
		// Calculează câte iconițe încap vertical
		const iconsPerColumn = Math.floor((desktopHeight - margin * 2) / spacing);
		
		// Poziție inițială: la dreapta
		let currentColumn = 0;
		const columnWidth = iconWidth + margin;
		const startLeft = desktopWidth - margin - iconWidth;
		const startTop = margin;
		
		const positions = loadIconPositions();
		
		// Obține pozițiile inițiale ale tuturor iconițelor
		const initialPositions = iconData.map(iconInfo => {
			const currentOffset = iconInfo.element.offset();
			const desktopOffset = desktopContainer.offset();
			return {
				element: iconInfo.element,
				initialLeft: currentOffset.left - desktopOffset.left,
				initialTop: currentOffset.top - desktopOffset.top,
				iconInfo: iconInfo
			};
		});
		
		// Calculează pozițiile finale pentru toate iconițele
		const finalPositions = iconData.map((iconInfo, index) => {
			const row = index % iconsPerColumn;
			const column = Math.floor(index / iconsPerColumn);
			
			let finalLeft = startLeft - (column * columnWidth);
			let finalTop = startTop + row * spacing;
			
			// Verifică dacă nu depășește zona de view
			if (finalTop + iconHeight > desktopHeight - margin) {
				// Trece la următorul rând (coloană nouă)
				const nextColumn = column + 1;
				const nextRow = 0;
				finalLeft = startLeft - (nextColumn * columnWidth);
				finalTop = startTop + nextRow * spacing;
			}
			
			return {
				element: iconInfo.element,
				finalLeft: finalLeft,
				finalTop: finalTop,
				iconInfo: iconInfo
			};
		});
		
		// Animează mutarea iconițelor
		finalPositions.forEach((finalPos, index) => {
			// Salvează noua poziție
			positions[finalPos.iconInfo.path] = {
				left: finalPos.finalLeft,
				top: finalPos.finalTop
			};
			
			// Animează mutarea cu jQuery
			finalPos.element.animate({
				left: finalPos.finalLeft + 'px',
				top: finalPos.finalTop + 'px'
			}, {
				duration: 500, // 500ms animație
				easing: 'swing',
				queue: false // Rulează toate animațiile în paralel
			});
		});
		
		// Salvează pozițiile
		saveIconPositions(positions);
	}

	function showViewOptions() {
		console.log('Show View Options');
		// TODO: Implementează view options
	}

	function importFromPhone() {
		console.log('Import from Phone');
		// TODO: Implementează import from phone
	}

	function sortDesktopIcons(sortBy) {
		// TODO: Implementează sortarea efectivă a iconițelor
		console.log('Sorting icons by:', sortBy);
	}

	// Funcții pentru clipboard operations
	async function handleCopy() {
		console.log('[CLIPBOARD] Copy action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[CLIPBOARD] No files selected for copy');
			return;
		}
		
		const filePaths = [];
		selectedIcons.each(function() {
			const filePath = $(this).attr('data-file-path');
			if (filePath) {
				filePaths.push(filePath);
			}
		});
		
		if (filePaths.length > 0) {
			try {
				console.log('[CLIPBOARD] Copying files to clipboard:', filePaths);
				await window.electronAPI.clipboardCopy(filePaths);
				console.log('[CLIPBOARD] Files successfully copied to clipboard:', filePaths);
			} catch (error) {
				console.error('[CLIPBOARD] Error copying files:', error);
			}
		}
	}

	async function handleCut() {
		console.log('[CLIPBOARD] Cut action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[CLIPBOARD] No files selected for cut');
			return;
		}
		
		const filePaths = [];
		selectedIcons.each(function() {
			const filePath = $(this).attr('data-file-path');
			if (filePath) {
				filePaths.push(filePath);
			}
		});
		
		if (filePaths.length > 0) {
			try {
				console.log('[CLIPBOARD] Cutting files to clipboard:', filePaths);
				await window.electronAPI.clipboardCut(filePaths);
				console.log('[CLIPBOARD] Files successfully cut to clipboard:', filePaths);
			} catch (error) {
				console.error('[CLIPBOARD] Error cutting files:', error);
			}
		}
	}

	async function handlePaste() {
		console.log('[CLIPBOARD] Paste action triggered');
		try {
			const result = await window.electronAPI.clipboardPaste();
			console.log('[CLIPBOARD] Clipboard paste result:', result);
			if (result.success && result.filePaths && result.filePaths.length > 0) {
				console.log('[CLIPBOARD] Files found in clipboard:', result.filePaths);
				// Obține directorul Desktop
				const desktopDirResult = await window.electronAPI.getDesktopDirectory();
				const desktopDir = desktopDirResult.desktopDir;
				
				if (!desktopDir) {
					console.error('[CLIPBOARD] Could not determine desktop directory');
					return;
				}
				
				console.log('[CLIPBOARD] Desktop directory:', desktopDir);
				
				// Pentru paste, copiem fișierele în Desktop (nu le mutăm)
				// Dacă utilizatorul vrea să lipească fișiere copiate din altă aplicație,
				// acestea vor fi copiate în Desktop
				for (const sourcePath of result.filePaths) {
					const fileName = sourcePath.split('/').pop();
					const destPath = desktopDir + '/' + fileName;
					
					try {
						console.log(`[CLIPBOARD] Pasting file: ${sourcePath} -> ${destPath}`);
						// Copiază fișierul în Desktop
						await window.electronAPI.copyFile(sourcePath, destPath);
						console.log(`[CLIPBOARD] Successfully pasted file: ${fileName}`);
					} catch (error) {
						console.error(`[CLIPBOARD] Error pasting file ${sourcePath}:`, error);
					}
				}
				
				console.log('[CLIPBOARD] Reloading desktop files...');
				// Reîncarcă iconițele desktop
				await loadDesktopIcons();
				console.log('[CLIPBOARD] Paste operation completed');
			} else {
				console.log('[CLIPBOARD] No files to paste from clipboard');
			}
		} catch (error) {
			console.error('[CLIPBOARD] Error pasting files:', error);
		}
	}

	// Funcții pentru ștergere fișiere
	async function handleDeletePermanent() {
		console.log('[DELETE] Permanent delete action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[DELETE] No files selected for permanent deletion');
			return;
		}
		
		const filePaths = [];
		selectedIcons.each(function() {
			const filePath = $(this).attr('data-file-path');
			if (filePath) {
				filePaths.push(filePath);
			}
		});
		
		if (filePaths.length > 0) {
			try {
				console.log('[DELETE] Permanently deleting files:', filePaths);
				const result = await window.electronAPI.deletePermanent(filePaths);
				if (result.success) {
					console.log('[DELETE] Files successfully deleted permanently');
					
					// Șterge pozițiile pentru fișierele șterse
					const savedPositions = loadIconPositions();
					filePaths.forEach(filePath => {
						delete savedPositions[filePath];
					});
					saveIconPositions(savedPositions);
					
					// Reîncarcă iconițele desktop
					await loadDesktopIcons();
				} else {
					console.error('[DELETE] Error deleting files:', result.error);
				}
			} catch (error) {
				console.error('[DELETE] Error deleting files:', error);
			}
		}
	}

	async function handleDeleteToTrash() {
		console.log('[DELETE] Delete to trash action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[DELETE] No files selected for trash');
			return;
		}
		
		const filePaths = [];
		selectedIcons.each(function() {
			const filePath = $(this).attr('data-file-path');
			if (filePath) {
				filePaths.push(filePath);
			}
		});
		
		if (filePaths.length > 0) {
			try {
				console.log('[DELETE] Moving files to trash:', filePaths);
				const result = await window.electronAPI.deleteToTrash(filePaths);
				if (result.success) {
					console.log('[DELETE] Files successfully moved to trash');
					
					// Șterge pozițiile pentru fișierele șterse
					const savedPositions = loadIconPositions();
					filePaths.forEach(filePath => {
						delete savedPositions[filePath];
					});
					saveIconPositions(savedPositions);
					
					// Reîncarcă iconițele desktop
					await loadDesktopIcons();
				} else {
					console.error('[DELETE] Error moving files to trash:', result.error);
				}
			} catch (error) {
				console.error('[DELETE] Error moving files to trash:', error);
			}
		}
	}

	let isCompressing = false; // Flag pentru a preveni apelurile multiple
	async function handleCompress() {
		// Previne apelurile multiple simultane
		if (isCompressing) {
			console.log('[COMPRESS] Compresia este deja în curs...');
			return;
		}
		
		console.log('[COMPRESS] Compress action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[COMPRESS] No files selected for compression');
			return;
		}
		
		isCompressing = true; // Setează flag-ul
		
		try {
			const filePaths = [];
			selectedIcons.each(function() {
				const filePath = $(this).attr('data-file-path');
				if (filePath) {
					filePaths.push(filePath);
				}
			});
			
			if (filePaths.length > 0) {
				// Obține directorul Desktop
				const desktopDirResult = await window.electronAPI.getDesktopDirectory();
				const desktopDir = desktopDirResult.desktopDir;
				
				if (!desktopDir) {
					console.error('[COMPRESS] Could not determine desktop directory');
					return;
				}
				
				// Creează calea pentru Archive.zip
				let zipPath = desktopDir + '/Archive.zip';
				let counter = 1;
				// Verifică dacă există deja un Archive.zip (verifică după nume, nu doar path)
				const desktopFiles = await window.electronAPI.getDesktopFiles();
				const existingFiles = desktopFiles.files || [];
				const existingNames = existingFiles.map(file => {
					const fileName = file.path.split('/').pop();
					return fileName;
				});
				
				let zipFileName = 'Archive.zip';
				while (existingNames.includes(zipFileName)) {
					zipFileName = `Archive ${counter}.zip`;
					counter++;
				}
				zipPath = desktopDir + '/' + zipFileName;
				
				console.log('[COMPRESS] Compressing files to:', zipPath);
				const result = await window.electronAPI.compressFiles(filePaths, zipPath);
				
				if (result.success) {
					console.log('[COMPRESS] Files successfully compressed to:', zipPath);
					
					// Obține poziția cursorului sau folosește poziția default
					let zipPosition = null;
					if (window.contextMenuClickPosition) {
						// Ajustează poziția pentru centrarea iconiței (120px width, 120px height)
						zipPosition = {
							left: window.contextMenuClickPosition.x - 60, // Centrare pe X
							top: window.contextMenuClickPosition.y - 60   // Centrare pe Y
						};
					}
					
					// Salvează poziția pentru Archive.zip
					if (zipPosition) {
						const savedPositions = loadIconPositions();
						savedPositions[zipPath] = zipPosition;
						saveIconPositions(savedPositions);
					}
					
					// Reîncarcă iconițele desktop pentru a afișa noul Archive.zip
					await loadDesktopIcons();
				} else {
					console.error('[COMPRESS] Error compressing files:', result.error);
				}
			}
		} catch (error) {
			console.error('[COMPRESS] Error compressing files:', error);
		} finally {
			// Resetează flag-ul după ce operația este completă
			isCompressing = false;
		}
	}

	async function handleDuplicate() {
		console.log('[DUPLICATE] Duplicate action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[DUPLICATE] No files selected for duplication');
			return;
		}
		
		try {
			// Obține directorul Desktop
			const desktopDirResult = await window.electronAPI.getDesktopDirectory();
			const desktopDir = desktopDirResult.desktopDir;
			
			if (!desktopDir) {
				console.error('[DUPLICATE] Could not determine desktop directory');
				return;
			}
			
			// Procesează fiecare item selectat
			for (let i = 0; i < selectedIcons.length; i++) {
				const iconElement = $(selectedIcons[i]);
				const sourcePath = iconElement.attr('data-file-path');
				const fileName = iconElement.attr('data-file-name');
				
				if (!sourcePath || !fileName) {
					continue;
				}
				
				// Creează numele nou cu "Copy of " în față
				let newFileName = 'Copy of ' + fileName;
				let destPath = desktopDir + '/' + newFileName;
				
				// Verifică dacă există deja un fișier cu acest nume
				const desktopFiles = await window.electronAPI.getDesktopFiles();
				const existingFiles = desktopFiles.files || [];
				let counter = 1;
				while (existingFiles.some(file => file.path === destPath)) {
					// Dacă există deja, adaugă un număr
					const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
					const nameWithoutExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
					newFileName = `Copy ${counter} of ${nameWithoutExt}${ext}`;
					destPath = desktopDir + '/' + newFileName;
					counter++;
				}
				
				console.log('[DUPLICATE] Duplicating:', sourcePath, 'to:', destPath);
				
				// Copiază fișierul/folderul
				const result = await window.electronAPI.copyFile(sourcePath, destPath);
				
				if (result.success) {
					console.log('[DUPLICATE] Successfully duplicated to:', destPath);
					
					// Obține poziția cursorului sau folosește poziția default
					let duplicatePosition = null;
					if (window.contextMenuClickPosition) {
						// Ajustează poziția pentru centrarea iconiței (120px width, 120px height)
						// Pentru mai multe duplicate, offset-uiește puțin
						duplicatePosition = {
							left: window.contextMenuClickPosition.x - 60 + (i * 10), // Centrare pe X + offset
							top: window.contextMenuClickPosition.y - 60 + (i * 10)   // Centrare pe Y + offset
						};
					}
					
					// Salvează poziția pentru duplicate
					if (duplicatePosition) {
						const savedPositions = loadIconPositions();
						savedPositions[destPath] = duplicatePosition;
						saveIconPositions(savedPositions);
					}
				} else {
					console.error('[DUPLICATE] Error duplicating file:', result.error);
				}
			}
			
			// Reîncarcă iconițele desktop pentru a afișa duplicatele
			await loadDesktopIcons();
		} catch (error) {
			console.error('[DUPLICATE] Error duplicating files:', error);
		}
	}

	async function handleMakeAlias() {
		console.log('[ALIAS] Make alias action triggered');
		const selectedIcons = $('.desktop-icon.selected');
		if (selectedIcons.length === 0) {
			console.log('[ALIAS] No files selected for alias creation');
			return;
		}
		
		try {
			// Obține directorul Desktop
			const desktopDirResult = await window.electronAPI.getDesktopDirectory();
			const desktopDir = desktopDirResult.desktopDir;
			
			if (!desktopDir) {
				console.error('[ALIAS] Could not determine desktop directory');
				return;
			}
			
			// Procesează fiecare item selectat
			for (let i = 0; i < selectedIcons.length; i++) {
				const iconElement = $(selectedIcons[i]);
				const sourcePath = iconElement.attr('data-file-path');
				const fileName = iconElement.attr('data-file-name');
				
				if (!sourcePath || !fileName) {
					continue;
				}
				
				// Creează numele nou cu "Alias of " în față
				let aliasFileName = 'Alias of ' + fileName;
				let aliasPath = desktopDir + '/' + aliasFileName;
				
				// Verifică dacă există deja un alias cu acest nume
				const desktopFiles = await window.electronAPI.getDesktopFiles();
				const existingFiles = desktopFiles.files || [];
				let counter = 1;
				while (existingFiles.some(file => file.path === aliasPath)) {
					// Dacă există deja, adaugă un număr
					const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
					const nameWithoutExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
					aliasFileName = `Alias ${counter} of ${nameWithoutExt}${ext}`;
					aliasPath = desktopDir + '/' + aliasFileName;
					counter++;
				}
				
				console.log('[ALIAS] Creating alias:', sourcePath, 'to:', aliasPath);
				
				// Creează link-ul simbolic
				const result = await window.electronAPI.makeAlias(sourcePath, aliasPath);
				
				if (result.success) {
					console.log('[ALIAS] Successfully created alias:', aliasPath);
					
					// Obține poziția cursorului sau folosește poziția default
					let aliasPosition = null;
					if (window.contextMenuClickPosition) {
						// Ajustează poziția pentru centrarea iconiței (120px width, 120px height)
						// Pentru mai multe alias-uri, offset-uiește puțin
						aliasPosition = {
							left: window.contextMenuClickPosition.x - 60 + (i * 10), // Centrare pe X + offset
							top: window.contextMenuClickPosition.y - 60 + (i * 10)   // Centrare pe Y + offset
						};
					}
					
					// Salvează poziția pentru alias
					if (aliasPosition) {
						const savedPositions = loadIconPositions();
						savedPositions[aliasPath] = aliasPosition;
						saveIconPositions(savedPositions);
					}
				} else {
					console.error('[ALIAS] Error creating alias:', result.error);
				}
			}
			
			// Reîncarcă iconițele desktop pentru a afișa alias-urile
			await loadDesktopIcons();
		} catch (error) {
			console.error('[ALIAS] Error creating aliases:', error);
		}
	}

	// Listener-e pentru shortcut-urile Ctrl+C, Ctrl+V, Ctrl+X
	if (window.electronAPI && window.electronAPI.onClipboardCopy) {
		window.electronAPI.onClipboardCopy((event) => {
			console.log('[CLIPBOARD] Ctrl+C shortcut detected');
			handleCopy();
		});
		
		window.electronAPI.onClipboardPaste((event) => {
			console.log('[CLIPBOARD] Ctrl+V shortcut detected');
			handlePaste();
		});
		
		window.electronAPI.onClipboardCut((event) => {
			console.log('[CLIPBOARD] Ctrl+X shortcut detected');
			handleCut();
		});
	}

	// Listener-e pentru shortcut-urile de ștergere
	if (window.electronAPI && window.electronAPI.onDeletePermanent) {
		window.electronAPI.onDeletePermanent((event) => {
			console.log('[DELETE] Option+Command+Backspace shortcut detected');
			handleDeletePermanent();
		});
		
		window.electronAPI.onDeleteToTrash((event) => {
			console.log('[DELETE] Command+Backspace shortcut detected');
			handleDeleteToTrash();
		});
	}