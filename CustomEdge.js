import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import parse from 'parse-svg-path';
import { Button } from 'antd';
import { EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';
import Icon from '../../base/Icon.js';
import useStore from '../../../store';

import './Edge.css';

const colorLine = getComputedStyle(document.documentElement).getPropertyValue('--colorLine');
const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary');

const Edge = ({ id,
    markerEnd,
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: sourcePos,
    targetPosition: targetPos }) => {
    const error = 40;
    const handlerRef = useRef(null);
    const edgeRef = useRef(null);
    const dragProps = useRef({});
    const reactFlowInstance = useReactFlow();
    const edges = useStore.use.edges();
    const setEdges = useStore.use.setEdges();
    const setActiveEdge = useStore.use.setActiveEdge();
    const activeEdgeId  = useStore.use.activeEdgeId();
    const currentEdge = edges.find(edge => edge.id === id);
    const [ positionY, setPositionY ] = useState(0);
    const [ dragInPorgress, setDragInProgress ] = useState(false);
    // eslint-disable-next-line no-magic-numbers
    const labelDefaultY = (ty + sy) / 2;
    const [ edgePath, labelX, labelY ] = getSmoothStepPath({
        sourceX        : sx,
        sourceY        : sy,
        centerY        : labelDefaultY - positionY,
        sourcePosition : sourcePos,
        targetPosition : targetPos,
        targetX        : tx,
        targetY        : ty,
        borderRadius   : 16,
        pathOptions    : {
            strokeWidth : 2
        },
        style : {
            strokeWidth : 2
        }
    });

    const startDragging = useCallback(({ clientY }) => {
        const draggingSpeed = 1 / reactFlowInstance.getZoom();
        const newTranslateCenterY = draggingSpeed * (dragProps.current.dragStartY - clientY) + positionY;

        setPositionY(prev => {
            const translated = labelDefaultY - prev;
            const maxStep = 20;

            if (maxStep < Math.abs(newTranslateCenterY) - Math.abs(prev) && newTranslateCenterY < 0) {
                return labelDefaultY - ty + error;
            }

            if (maxStep < Math.abs(newTranslateCenterY) - Math.abs(prev) && newTranslateCenterY > 0) {
                return labelDefaultY - sy - error;
            }

            if (translated > sy + error && translated < ty - error) {
                return newTranslateCenterY;
            }

            if (newTranslateCenterY < prev && sy < translated && translated < ty - error) {
                return newTranslateCenterY;
            }

            if (ty > translated && newTranslateCenterY > prev && translated > sy + error) {
                return newTranslateCenterY;
            }

            return prev;
        });
    }, [ positionY, ty, sy ]);

    const stopDragging = useCallback(() => {
        window.removeEventListener('mousemove', startDragging, false);
        window.removeEventListener('mouseup', stopDragging, false);

        setDragInProgress(false);
    }, [ positionY, edges, currentEdge, ty, sy ]);

    const handleClickEdge = useCallback(() => {
        setActiveEdge(id);
    }, [ id ]);

    const initialiseDrag = useCallback(event => {
        const { target, clientX, clientY } = event;
        const { offsetTop, offsetLeft } = target;
        const { left, top } = handlerRef.current.getBoundingClientRect();

        dragProps.current = {
            dragStartLeft : left - offsetLeft,
            dragStartTop  : top - offsetTop,
            dragStartX    : clientX,
            dragStartY    : clientY
        };

        setDragInProgress(true);

        window.addEventListener('mousemove', startDragging, false);
        window.addEventListener('mouseup', stopDragging, false);
    }, [ positionY, ty, sy ]);

    useEffect(() => {
        if (labelDefaultY - positionY - sy < error && positionY !== 0) {
            // eslint-disable-next-line no-magic-numbers
            setPositionY(prev => prev - 2 > 0 ? prev - 2 : 0);
        }

        if (labelDefaultY - positionY - ty > -error && positionY !== 0) {
            // eslint-disable-next-line no-magic-numbers
            setPositionY(prev => prev + 2 <= 0 ? prev + 2 : 0);
        }
    }, [ positionY, ty, tx, sx, sy ]);

    useEffect(() => {
        if (currentEdge) {
            setPositionY(currentEdge.positionY);
        }
    }, [ currentEdge ]);

    useEffect(() => {
        if (dragInPorgress === false) {
            setEdges(edges.map(edge => {
                if (edge.id === id) {
                    return {
                        ...edge,
                        positionY
                    };
                }

                return edge;
            }));
        }
    }, [ dragInPorgress, positionY ]);

    // I allow 2 curves because a component does not have handlers for more curves for now
    // if you want to add handlers for 3 or more curves, feel free
    const allowedCountCurvedLines = 2;

    const displayLabel = useMemo(() => {
        const quadraticCurve = 'Q';
        const quadraticCurves = parse(edgePath).filter(([ method ]) => method === quadraticCurve);

        if (quadraticCurves.length !== allowedCountCurvedLines) return false;

        const [ initialMethod, initialCurveX ] = quadraticCurves[0];

        return quadraticCurves.slice(1)
            .every(([ method, curveX ]) => Math.abs(curveX - initialCurveX) > error);
    }, [ edgePath ]);

    return (
        <>
            <path
                id={id}
                style={{ strokeWidth: '2px' }}
                className='react-flow__edge-path'
                d={edgePath}
                ref={edgeRef}
                markerEnd={markerEnd}
            />
            <path
                id={id}
                style={{ strokeWidth: '2px', fill: 'none', stroke: id === activeEdgeId ? primaryColor : 'none' }}
                className='react-flow__edge-interaction'
                d={edgePath}
                markerEnd={markerEnd}
                strokeDasharray={15}
            />
            <path
                id={id}
                style={{ strokeWidth: '20px', stroke: 'transparent' }}
                className='react-flow__edge-path'
                d={edgePath}
                onClick={handleClickEdge}
            />
            {displayLabel && activeEdgeId === id &&
            <EdgeLabelRenderer>
                <div

                    style={{
                        position      : 'absolute',
                        transform     : `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize      : 12,
                        // everything inside EdgeLabelRenderer has no pointer events by default
                        // if you have an interactive element, set pointer-events: all
                        pointerEvents : 'all'
                    }}
                    className='nodrag nopan'
                >
                    <Button
                        onMouseDown={initialiseDrag}
                        ref={handlerRef}
                        className='edgebutton'
                        icon={<Icon type='expandAltOutlined' />}
                    />
                </div>
            </EdgeLabelRenderer>
            }

        </>
    );
};


Edge.propTypes = {
    id             : PropTypes.string,
    sourceX        : PropTypes.number,
    sourceY        : PropTypes.number,
    targetX        : PropTypes.number,
    targetY        : PropTypes.number,
    sourcePosition : PropTypes.string,
    targetPosition : PropTypes.string,
    markerEnd      : PropTypes.string
};

Edge.defaultProps = {
    id             : '',
    sourceX        : 0,
    sourceY        : 0,
    targetX        : 0,
    targetY        : 0,
    sourcePosition : '',
    targetPosition : '',
    markerEnd      : ''
};

export { Edge };
