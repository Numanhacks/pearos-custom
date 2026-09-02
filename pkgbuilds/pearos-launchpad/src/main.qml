import QtQuick 2.15
import QtQuick.Window 2.15
import QtQuick.Controls 2.15
import QtQuick.Layouts 1.15

Window { id: root; width: 900; height: 600; visibility: Window.FullScreen; color: "#80000000"
    Rectangle { anchors.fill: parent; color: "#BFFFFFFF" }
    ColumnLayout { anchors.fill: parent; anchors.margins: 24
        TextField { id: search; placeholderText: "Search"; Layout.alignment: Qt.AlignHCenter; width: 300; height: 32; background: Rectangle{ radius: 6; color: "white"; border.color: "#D1D1D6"} }
        GridView { id: grid; Layout.fillWidth: true; Layout.fillHeight: true; cellWidth: 120; cellHeight: 120; model: ListModel{ ListElement{name:"Finder"} ListElement{name:"Calculator"} ListElement{name:"Notes"} ListElement{name:"Calendar"} ListElement{name:"About This Mac"} }
            delegate: Column { width: 96; height: 96; spacing: 8
                Rectangle { width: 64; height: 64; radius: 12; color: "#007AFF"; anchors.horizontalCenter: parent.horizontalCenter; Label{ anchors.centerIn: parent; text: model.name.substring(0,1); color: "white"; font.pixelSize: 24 } }
                Label { text: model.name; color: "#1D1D1F"; font.pixelSize: 11; anchors.horizontalCenter: parent.horizontalCenter; elide: Text.ElideRight; width: 96; horizontalAlignment: Text.AlignHCenter }
            }
        }
    }
    MouseArea { anchors.fill: parent; onClicked: if(mouseX<50||mouseY<50||mouseX>root.width-50) Qt.quit(); enabled: false }
    Shortcut { sequence: "Escape"; onActivated: Qt.quit() }
}
