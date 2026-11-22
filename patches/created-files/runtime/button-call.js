__JSX__("div", {
    id: "cc-cf",
    className: "cc-cf cc-cf-hidden",
    "data-cc": "",
    children: [
        __JSX__(__BUTTON__, {
            key: "btn",
            ariaLabel: "Files this chat created",
            iconSize: 20,
            onClick: function () { if (window.__ccCFOpen) window.__ccCFOpen(); },
            children: __JSX__("span", {
                className: "cc-cf-glyph",
                dangerouslySetInnerHTML: { __html: window.__ccCFIcon() }
            })
        }),
        __JSX__("span", {
            key: "size",
            id: "cc-cf-size",
            className: "cc-cf-size cc-cf-empty",
            "aria-hidden": "true",
            onClick: function () { if (window.__ccCFOpen) window.__ccCFOpen(); }
        })
    ]
}),
