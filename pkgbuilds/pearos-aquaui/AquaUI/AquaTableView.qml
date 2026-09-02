import QtQuick 2.15
import QtQuick.Controls 2.15
ListView {
    id: root; clip: true
    delegate: Rectangle { width: ListView.view.width; height: 28; color: ma.containsMouse ? "#E8F4FD" : (ListView.isCurrentItem ? "#0066CC" : "transparent")
        MouseArea { id: ma; anchors.fill: parent; hoverEnabled: true }
        Label { anchors.verticalCenter: parent.verticalCenter; anchors.left: parent.left; anchors.leftMargin: 8; text: model.display || modelData || ""; color: ListView.isCurrentItem ? "white" : "#1D1D1F"; font.family: "Inter"; font.pixelSize: 13; elide: Text.ElideRight; width: parent.width - 16 }
    }
}
